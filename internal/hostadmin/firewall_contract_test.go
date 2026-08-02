package hostadmin

import (
	"os"
	"reflect"
	"strings"
	"testing"
)

func TestNormalizeUFWRuleRequest(t *testing.T) {
	tests := []struct {
		name    string
		input   FirewallRuleRequest
		want    FirewallRuleRequest
		wantErr string
	}{
		{
			name:  "normalizes whitespace and defaults protocol",
			input: FirewallRuleRequest{Action: " ALLOW ", Direction: " IN ", Port: " 443 ", Source: " any ", Comment: " HTTPS "},
			want:  FirewallRuleRequest{Action: "allow", Direction: "in", Protocol: "tcp", Port: "443", Source: "any", Comment: "HTTPS"},
		},
		{name: "rejects descending range", input: FirewallRuleRequest{Action: "allow", Direction: "in", Protocol: "tcp", Port: "2000:1000"}, wantErr: "起始值"},
		{name: "range requires protocol", input: FirewallRuleRequest{Action: "allow", Direction: "in", Protocol: "any", Port: "1000:2000"}, wantErr: "必须选择 TCP 或 UDP"},
		{name: "limit requires tcp", input: FirewallRuleRequest{Action: "limit", Direction: "in", Protocol: "udp", Port: "53"}, wantErr: "仅支持 TCP"},
		{name: "rejects invalid cidr", input: FirewallRuleRequest{Action: "deny", Direction: "in", Protocol: "tcp", Port: "22", Source: "999.1.1.1"}, wantErr: "有效 IP 或 CIDR"},
		{name: "rejects newline comment", input: FirewallRuleRequest{Action: "allow", Direction: "in", Protocol: "tcp", Port: "22", Comment: "bad\ncomment"}, wantErr: "备注无效"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizeUFWRuleRequest(tt.input)
			if tt.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("normalizeUFWRuleRequest() error = %v, want containing %q", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("normalizeUFWRuleRequest() unexpected error: %v", err)
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("normalizeUFWRuleRequest() = %#v, want %#v", got, tt.want)
			}
		})
	}
}

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
			name: "reject range",
			req:  FirewallRuleRequest{Action: "reject", Direction: "in", Protocol: "tcp", Port: "1000:2000"},
			want: []string{"reject", "in", "to", "any", "port", "1000:2000", "proto", "tcp"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := buildUFWRuleArgs(tt.req); !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("buildUFWRuleArgs() = %#v, want %#v", got, tt.want)
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
