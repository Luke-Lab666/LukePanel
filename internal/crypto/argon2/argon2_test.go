package argon2

import (
	"encoding/hex"
	"testing"
)

func TestIDKeyVector(t *testing.T) {
	got := IDKey([]byte("password"), []byte("somesalt"), 1, 64, 1, 24)
	const want = "655ad15eac652dc59f7170a7332bf49b8469be1fdb9c28bb"
	if hex.EncodeToString(got) != want {
		t.Fatalf("got %x want %s", got, want)
	}
}
