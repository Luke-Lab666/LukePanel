package server

import "testing"

func TestCryptoProfileForGo126(t *testing.T) {
	profile := cryptoProfileFor("go1.26.5", "tlsmlkem=1,tlssecpmlkem=1")
	if !profile.PostQuantumCapable {
		t.Fatal("Go 1.26 profile should be post-quantum capable")
	}
	if profile.OutboundTLS != "X25519MLKEM768 + SecP256r1MLKEM768 + SecP384r1MLKEM1024" {
		t.Fatalf("unexpected profile: %s", profile.OutboundTLS)
	}
}

func TestCryptoProfileHonorsGODEBUGDisable(t *testing.T) {
	profile := cryptoProfileFor("go1.26.5", "tlsmlkem=0,tlssecpmlkem=1")
	if profile.PostQuantumCapable {
		t.Fatal("tlsmlkem=0 should disable the post-quantum profile")
	}
}

func TestCryptoProfileForLegacyBuild(t *testing.T) {
	profile := cryptoProfileFor("go1.23.2", "")
	if profile.PostQuantumCapable {
		t.Fatal("Go 1.23 should not be reported as ML-KEM capable")
	}
}

func TestCryptoProfileGo126SecPDisabledKeepsX25519Hybrid(t *testing.T) {
	profile := cryptoProfileFor("go1.26.5", "tlssecpmlkem=0")
	if !profile.PostQuantumCapable || profile.OutboundTLS != "X25519MLKEM768" {
		t.Fatalf("unexpected fallback profile: %#v", profile)
	}
}
