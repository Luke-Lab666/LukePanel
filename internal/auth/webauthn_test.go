package auth

import (
	"crypto/sha256"
	"encoding/base64"
	"strings"
	"testing"
)

func TestVerifyPasskeyRequiresUserVerificationFlag(t *testing.T) {
	const (
		credentialID = "credential-id"
		challenge    = "challenge-value"
		origin       = "https://panel.example"
		rpID         = "panel.example"
	)
	clientData := []byte(`{"type":"webauthn.get","challenge":"challenge-value","origin":"https://panel.example"}`)
	authData := make([]byte, 37)
	hash := sha256.Sum256([]byte(rpID))
	copy(authData[:32], hash[:])
	authData[32] = 0x01 // User present, but User Verified is deliberately absent.
	var response PasskeyAssertionResponse
	response.ID = base64.RawURLEncoding.EncodeToString([]byte(credentialID))
	response.RawID = response.ID
	response.Response.ClientDataJSON = base64.RawURLEncoding.EncodeToString(clientData)
	response.Response.AuthenticatorData = base64.RawURLEncoding.EncodeToString(authData)
	response.Response.Signature = base64.RawURLEncoding.EncodeToString([]byte{1})
	credential := PasskeyCredential{ID: base64.RawURLEncoding.EncodeToString([]byte(credentialID))}
	_, err := VerifyPasskey(response, credential, challenge, origin, rpID)
	if err == nil || !strings.Contains(err.Error(), "设备 PIN 验证") {
		t.Fatalf("VerifyPasskey error = %v, want missing user verification", err)
	}
}

func TestParseAttestedAuthDataRequiresUserVerificationFlag(t *testing.T) {
	const rpID = "panel.example"
	data := make([]byte, 55)
	hash := sha256.Sum256([]byte(rpID))
	copy(data[:32], hash[:])
	data[32] = 0x01 | 0x40 // User present and attested data, but no User Verified flag.
	_, _, _, _, err := parseAttestedAuthData(data, rpID)
	if err == nil || !strings.Contains(err.Error(), "本机验证") {
		t.Fatalf("parseAttestedAuthData error = %v, want missing user verification", err)
	}
}
