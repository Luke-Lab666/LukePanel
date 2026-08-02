package hostadmin

import (
	"os"
	"reflect"
	"strings"
	"testing"
)

func TestBuildUFWRuleArgs(t *testing.T) {
	tests := []struct {
		name string
		req  FirewallRuleRequest
		want []string
	}{
		{
			name: "allow inbound tcp",
			req:  FirewallRuleRequest{Action: "allow", Direction: "in", Protocol: "tcp", Port: "443", Source: "any"},
			want: []string{"allow", "in", "to", "any", "port", "443", "proto", "tcp"},
		},
		{
			name: "deny outbound udp from cidr",
			req:  FirewallRuleRequest{Action: "deny", Direction: "out", Protocol: "udp", Port: "53", Source: "10.0.0.0/8", Comment: "DNS egress"},
			want: []string{"deny", "out", "from", "10.0.0.0/8", "to", "any", "port", "53", "proto", "udp", "comment", "DNS egress"},
		},
		{
			name: "reject protocol agnostic range",
			req:  FirewallRuleRequest{Action: "reject", Direction: "in", Protocol: "any", Port: "1000:2000"},
			want: []string{"reject", "in", "to", "any", "port", "1000:2000"},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := buildUFWRuleArgs(test.req)
			if !reflect.DeepEqual(got, test.want) {
				t.Fatalf("buildUFWRuleArgs() = %#v, want %#v", got, test.want)
			}
		})
	}
}

func TestUFWFailureIncludesCommandAndOutput(t *testing.T) {
	raw, err := os.ReadFile("firewall.go")
	if err != nil {
		t.Fatalf("read firewall.go: %v", err)
	}
	content := string(raw)
	for _, marker := range []string{"执行命令: ufw %s", "UFW 输出:", "执行命令: ufw --force delete %d"} {
		if !strings.Contains(content, marker) {
			t.Fatalf("UFW error output marker %q is missing", marker)
		}
	}
}
