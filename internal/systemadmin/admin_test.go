package systemadmin

import "testing"

func TestVirtualMountClassification(t *testing.T) {
	cases := []struct {
		filesystem string
		mountpoint string
		want       bool
	}{
		{"xfs", "/", false},
		{"overlay", "/", false},
		{"ext4", "/boot", false},
		{"overlay", "/var/lib/docker/overlay2/example", true},
		{"nsfs", "/run/docker/netns/default", true},
		{"xfs", "/etc/hosts", true},
		{"bpf", "/sys/fs/bpf", true},
	}
	for _, tc := range cases {
		if got := virtualMount(tc.filesystem, tc.mountpoint); got != tc.want {
			t.Fatalf("virtualMount(%q, %q) = %v, want %v", tc.filesystem, tc.mountpoint, got, tc.want)
		}
	}
}
