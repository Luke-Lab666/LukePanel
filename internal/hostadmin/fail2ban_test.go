package hostadmin

import "testing"

func TestParseFail2BanStatusOutput(t *testing.T) {
	output := `Status for the jail: sshd
|- Filter
|  |- Currently failed: 2
|  ` + "`" + `- Total failed: 48
` + "`" + `- Actions
   |- Currently banned: 3
   |- Total banned: 10
   ` + "`" + `- Banned IP list: 203.0.113.8 198.51.100.2`
	var info Fail2BanInfo
	parseFail2BanStatusOutput(output, &info)
	if info.CurrentlyFailed != 2 || info.TotalFailed != 48 || info.CurrentlyBanned != 3 || info.TotalBanned != 10 {
		t.Fatalf("unexpected counters: %+v", info)
	}
	if len(info.BannedIPs) != 2 || info.BannedIPs[0] != "198.51.100.2" || info.BannedIPs[1] != "203.0.113.8" {
		t.Fatalf("unexpected banned IPs: %#v", info.BannedIPs)
	}
}

func TestNormalizeIPOrCIDR(t *testing.T) {
	cases := map[string]string{
		"203.0.113.8":    "203.0.113.8",
		"192.168.1.8/24": "192.168.1.0/24",
		"2001:db8::1":    "2001:db8::1",
	}
	for input, want := range cases {
		got, err := normalizeIPOrCIDR(input)
		if err != nil || got != want {
			t.Fatalf("normalize %q = %q, %v; want %q", input, got, err, want)
		}
	}
	if _, err := normalizeIPOrCIDR("not-an-ip"); err == nil {
		t.Fatal("expected invalid value to fail")
	}
}

func TestIPEntryContains(t *testing.T) {
	if !ipEntryContains("192.168.0.0/16", "192.168.20.3") {
		t.Fatal("CIDR should contain address")
	}
	if ipEntryContains("192.168.0.0/16", "203.0.113.1") {
		t.Fatal("CIDR should not contain address")
	}
}
