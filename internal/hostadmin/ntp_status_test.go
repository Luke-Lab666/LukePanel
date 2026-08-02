package hostadmin

import "testing"

func TestParseSystemdProperties(t *testing.T) {
	got := parseSystemdProperties("NTPSynchronized=yes\nTimezone=Asia/Shanghai\nServerName=ntp.example.com\nMalformed\n")
	want := map[string]string{
		"NTPSynchronized": "yes",
		"Timezone":        "Asia/Shanghai",
		"ServerName":      "ntp.example.com",
	}
	if len(got) != len(want) {
		t.Fatalf("len(properties) = %d, want %d: %#v", len(got), len(want), got)
	}
	for key, value := range want {
		if got[key] != value {
			t.Fatalf("properties[%q] = %q, want %q", key, got[key], value)
		}
	}
}
