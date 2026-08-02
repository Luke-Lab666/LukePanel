package sshadmin

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestParseKeyWithAuthorizedKeysOptions(t *testing.T) {
	blob := base64.StdEncoding.EncodeToString([]byte(strings.Repeat("k", 32)))
	line := `from="192.0.2.0/24",no-agent-forwarding ssh-ed25519 ` + blob + ` phone-key`
	key, err := parseKey(line)
	if err != nil {
		t.Fatal(err)
	}
	if key.Type != "ssh-ed25519" || key.Comment != "phone-key" || !strings.HasPrefix(key.Fingerprint, "SHA256:") {
		t.Fatalf("unexpected key: %#v", key)
	}
}

func TestParseKeyRejectsInvalid(t *testing.T) {
	if _, err := parseKey("not-a-key"); err == nil {
		t.Fatal("expected invalid key")
	}
}
