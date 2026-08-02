package hostadmin

import "testing"

func TestParseManagedSysctlPreset(t *testing.T) {
	tests := []struct {
		name string
		data string
		want string
	}{
		{name: "balanced", data: "# Managed by LukePanel: balanced\nvm.swappiness = 10\n", want: "balanced"},
		{name: "network", data: "# Managed by LukePanel: network\nnet.ipv4.tcp_congestion_control = bbr\n", want: "network"},
		{name: "low memory", data: "# Managed by LukePanel: low-memory\nvm.dirty_ratio = 10\n", want: "low-memory"},
		{name: "unknown managed file", data: "# Managed by LukePanel: experimental\nnet.core.somaxconn = 1024\n", want: "custom"},
		{name: "manual file", data: "vm.swappiness = 5\n", want: "custom"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := parseManagedSysctlPreset([]byte(test.data)); got != test.want {
				t.Fatalf("parseManagedSysctlPreset() = %q, want %q", got, test.want)
			}
		})
	}
}
