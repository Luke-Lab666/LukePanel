package auth

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"
)

type PasskeyCredential struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	PublicX   string    `json:"public_x"`
	PublicY   string    `json:"public_y"`
	SignCount uint32    `json:"sign_count"`
	CreatedAt time.Time `json:"created_at"`
	LastUsed  time.Time `json:"last_used,omitempty"`
}

type PasskeyCreationResponse struct {
	ID       string `json:"id"`
	RawID    string `json:"raw_id"`
	Response struct {
		ClientDataJSON    string `json:"client_data_json"`
		AttestationObject string `json:"attestation_object"`
	} `json:"response"`
}

type PasskeyAssertionResponse struct {
	ID       string `json:"id"`
	RawID    string `json:"raw_id"`
	Response struct {
		ClientDataJSON    string `json:"client_data_json"`
		AuthenticatorData string `json:"authenticator_data"`
		Signature         string `json:"signature"`
		UserHandle        string `json:"user_handle,omitempty"`
	} `json:"response"`
}

type clientData struct {
	Type      string `json:"type"`
	Challenge string `json:"challenge"`
	Origin    string `json:"origin"`
}

func RandomChallenge(n int) (string, error) {
	if n < 16 {
		n = 32
	}
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func RegisterPasskey(response PasskeyCreationResponse, challenge, origin, rpID, name string) (PasskeyCredential, error) {
	clientRaw, err := decodeBase64URL(response.Response.ClientDataJSON)
	if err != nil {
		return PasskeyCredential{}, errors.New("客户端数据格式错误")
	}
	if err := verifyClientData(clientRaw, "webauthn.create", challenge, origin); err != nil {
		return PasskeyCredential{}, err
	}
	attestation, err := decodeBase64URL(response.Response.AttestationObject)
	if err != nil {
		return PasskeyCredential{}, errors.New("Passkey 注册数据格式错误")
	}
	value, _, err := decodeCBOR(attestation, 0)
	if err != nil {
		return PasskeyCredential{}, fmt.Errorf("解析 Passkey 注册数据失败: %w", err)
	}
	root, ok := value.(map[any]any)
	if !ok {
		return PasskeyCredential{}, errors.New("Passkey 注册对象无效")
	}
	authData, ok := mapBytes(root, "authData")
	if !ok {
		return PasskeyCredential{}, errors.New("Passkey 缺少 authenticatorData")
	}
	credentialID, x, y, signCount, err := parseAttestedAuthData(authData, rpID)
	if err != nil {
		return PasskeyCredential{}, err
	}
	rawID, err := decodeBase64URL(firstNonEmpty(response.RawID, response.ID))
	if err != nil {
		return PasskeyCredential{}, errors.New("Passkey ID 无效")
	}
	if !bytes.Equal(rawID, credentialID) {
		return PasskeyCredential{}, errors.New("Passkey ID 与注册数据不一致")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		name = "此设备 Passkey"
	}
	if len(name) > 80 {
		name = name[:80]
	}
	return PasskeyCredential{ID: base64.RawURLEncoding.EncodeToString(credentialID), Name: name, PublicX: base64.RawURLEncoding.EncodeToString(x), PublicY: base64.RawURLEncoding.EncodeToString(y), SignCount: signCount, CreatedAt: time.Now().UTC()}, nil
}

func VerifyPasskey(response PasskeyAssertionResponse, credential PasskeyCredential, challenge, origin, rpID string) (uint32, error) {
	rawID, err := decodeBase64URL(firstNonEmpty(response.RawID, response.ID))
	if err != nil {
		return 0, errors.New("Passkey ID 无效")
	}
	expectedID, err := decodeBase64URL(credential.ID)
	if err != nil || !bytes.Equal(rawID, expectedID) {
		return 0, errors.New("Passkey 不匹配")
	}
	clientRaw, err := decodeBase64URL(response.Response.ClientDataJSON)
	if err != nil {
		return 0, errors.New("客户端数据格式错误")
	}
	if err := verifyClientData(clientRaw, "webauthn.get", challenge, origin); err != nil {
		return 0, err
	}
	authData, err := decodeBase64URL(response.Response.AuthenticatorData)
	if err != nil {
		return 0, errors.New("authenticatorData 格式错误")
	}
	if len(authData) < 37 {
		return 0, errors.New("authenticatorData 长度不足")
	}
	rpHash := sha256.Sum256([]byte(rpID))
	if !bytes.Equal(authData[:32], rpHash[:]) {
		return 0, errors.New("Passkey 域名校验失败")
	}
	flags := authData[32]
	if flags&0x01 == 0 {
		return 0, errors.New("Passkey 未确认用户存在")
	}
	if flags&0x04 == 0 {
		return 0, errors.New("Passkey 未完成人脸、指纹或设备 PIN 验证")
	}
	signCount := binary.BigEndian.Uint32(authData[33:37])
	sig, err := decodeBase64URL(response.Response.Signature)
	if err != nil {
		return 0, errors.New("签名格式错误")
	}
	xBytes, err := decodeBase64URL(credential.PublicX)
	if err != nil {
		return 0, errors.New("Passkey 公钥损坏")
	}
	yBytes, err := decodeBase64URL(credential.PublicY)
	if err != nil {
		return 0, errors.New("Passkey 公钥损坏")
	}
	public := ecdsa.PublicKey{Curve: elliptic.P256(), X: new(big.Int).SetBytes(xBytes), Y: new(big.Int).SetBytes(yBytes)}
	if !public.Curve.IsOnCurve(public.X, public.Y) {
		return 0, errors.New("Passkey 公钥无效")
	}
	clientHash := sha256.Sum256(clientRaw)
	signed := append(append([]byte{}, authData...), clientHash[:]...)
	digest := sha256.Sum256(signed)
	if !ecdsa.VerifyASN1(&public, digest[:], sig) {
		return 0, errors.New("Passkey 签名验证失败")
	}
	if credential.SignCount > 0 && signCount > 0 && signCount <= credential.SignCount {
		return 0, errors.New("Passkey 计数异常，可能已被复制")
	}
	return signCount, nil
}

func verifyClientData(raw []byte, expectedType, challenge, origin string) error {
	var data clientData
	if err := json.Unmarshal(raw, &data); err != nil {
		return errors.New("clientDataJSON 无效")
	}
	if data.Type != expectedType {
		return errors.New("Passkey 操作类型不匹配")
	}
	if data.Challenge != challenge {
		return errors.New("Passkey 挑战已失效")
	}
	if normalizeOrigin(data.Origin) != normalizeOrigin(origin) {
		return errors.New("Passkey 来源校验失败")
	}
	return nil
}

func parseAttestedAuthData(data []byte, rpID string) ([]byte, []byte, []byte, uint32, error) {
	if len(data) < 55 {
		return nil, nil, nil, 0, errors.New("Passkey authenticatorData 长度不足")
	}
	hash := sha256.Sum256([]byte(rpID))
	if !bytes.Equal(data[:32], hash[:]) {
		return nil, nil, nil, 0, errors.New("Passkey 域名校验失败")
	}
	flags := data[32]
	if flags&0x01 == 0 || flags&0x04 == 0 || flags&0x40 == 0 {
		return nil, nil, nil, 0, errors.New("Passkey 注册必须完成用户确认、本机验证并包含凭据")
	}
	signCount := binary.BigEndian.Uint32(data[33:37])
	offset := 37 + 16
	if len(data) < offset+2 {
		return nil, nil, nil, 0, errors.New("Passkey 凭据数据不完整")
	}
	idLen := int(binary.BigEndian.Uint16(data[offset : offset+2]))
	offset += 2
	if idLen < 1 || idLen > 1024 || len(data) < offset+idLen {
		return nil, nil, nil, 0, errors.New("Passkey 凭据 ID 无效")
	}
	credentialID := append([]byte{}, data[offset:offset+idLen]...)
	offset += idLen
	value, _, err := decodeCBOR(data, offset)
	if err != nil {
		return nil, nil, nil, 0, fmt.Errorf("解析 Passkey 公钥失败: %w", err)
	}
	key, ok := value.(map[any]any)
	if !ok {
		return nil, nil, nil, 0, errors.New("Passkey 公钥结构无效")
	}
	kty, _ := mapInt(key, int64(1))
	alg, _ := mapInt(key, int64(3))
	crv, _ := mapInt(key, int64(-1))
	x, okX := mapBytes(key, int64(-2))
	y, okY := mapBytes(key, int64(-3))
	if kty != 2 || alg != -7 || crv != 1 || !okX || !okY || len(x) != 32 || len(y) != 32 {
		return nil, nil, nil, 0, errors.New("当前仅支持 ES256 Passkey")
	}
	return credentialID, x, y, signCount, nil
}

func normalizeOrigin(value string) string {
	return strings.TrimRight(strings.ToLower(strings.TrimSpace(value)), "/")
}
func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
func decodeBase64URL(value string) ([]byte, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, errors.New("empty")
	}
	return base64.RawURLEncoding.DecodeString(strings.TrimRight(value, "="))
}

// Minimal CBOR decoder sufficient for WebAuthn attestation objects and COSE keys.
func decodeCBOR(data []byte, offset int) (any, int, error) {
	if offset >= len(data) {
		return nil, offset, errors.New("unexpected end")
	}
	initial := data[offset]
	offset++
	major := initial >> 5
	add := initial & 31
	length, next, err := cborLength(data, offset, add)
	if err != nil {
		return nil, offset, err
	}
	offset = next
	switch major {
	case 0:
		return int64(length), offset, nil
	case 1:
		return -1 - int64(length), offset, nil
	case 2:
		if length > uint64(len(data)-offset) {
			return nil, offset, errors.New("byte string exceeds input")
		}
		end := offset + int(length)
		return append([]byte{}, data[offset:end]...), end, nil
	case 3:
		if length > uint64(len(data)-offset) {
			return nil, offset, errors.New("text string exceeds input")
		}
		end := offset + int(length)
		return string(data[offset:end]), end, nil
	case 4:
		arr := make([]any, 0, int(length))
		for i := uint64(0); i < length; i++ {
			v, n, e := decodeCBOR(data, offset)
			if e != nil {
				return nil, offset, e
			}
			arr = append(arr, v)
			offset = n
		}
		return arr, offset, nil
	case 5:
		m := make(map[any]any, int(length))
		for i := uint64(0); i < length; i++ {
			k, n, e := decodeCBOR(data, offset)
			if e != nil {
				return nil, offset, e
			}
			offset = n
			v, n, e := decodeCBOR(data, offset)
			if e != nil {
				return nil, offset, e
			}
			offset = n
			m[k] = v
		}
		return m, offset, nil
	case 6:
		v, n, e := decodeCBOR(data, offset)
		return v, n, e
	case 7:
		switch add {
		case 20:
			return false, offset, nil
		case 21:
			return true, offset, nil
		case 22, 23:
			return nil, offset, nil
		}
		return nil, offset, fmt.Errorf("unsupported simple value %d", add)
	default:
		return nil, offset, fmt.Errorf("unsupported CBOR major type %d", major)
	}
}
func cborLength(data []byte, offset int, add byte) (uint64, int, error) {
	if add < 24 {
		return uint64(add), offset, nil
	}
	switch add {
	case 24:
		if offset+1 > len(data) {
			break
		}
		return uint64(data[offset]), offset + 1, nil
	case 25:
		if offset+2 > len(data) {
			break
		}
		return uint64(binary.BigEndian.Uint16(data[offset : offset+2])), offset + 2, nil
	case 26:
		if offset+4 > len(data) {
			break
		}
		return uint64(binary.BigEndian.Uint32(data[offset : offset+4])), offset + 4, nil
	case 27:
		if offset+8 > len(data) {
			break
		}
		return binary.BigEndian.Uint64(data[offset : offset+8]), offset + 8, nil
	}
	return 0, offset, errors.New("unsupported or truncated CBOR length")
}
func mapBytes(m map[any]any, key any) ([]byte, bool) {
	v, ok := m[key]
	if !ok {
		return nil, false
	}
	b, ok := v.([]byte)
	return b, ok
}
func mapInt(m map[any]any, key any) (int64, bool) {
	v, ok := m[key]
	if !ok {
		return 0, false
	}
	n, ok := v.(int64)
	return n, ok
}
