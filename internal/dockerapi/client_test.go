package dockerapi

import "testing"

func TestValidateRecreateRequest(t *testing.T) {
	req := RecreateRequest{
		ID: "abcdef123456", Name: "web", Image: "nginx:latest", RestartPolicy: "unless-stopped", Start: true,
		Env:    []string{"MODE=prod"},
		Ports:  []EditPort{{HostIP: "0.0.0.0", HostPort: "8080", ContainerPort: "80", Protocol: "tcp"}},
		Mounts: []EditMount{{Type: "bind", Source: "/opt/web", Target: "/usr/share/nginx/html"}},
	}
	if err := validateRecreateRequest(&req); err != nil {
		t.Fatal(err)
	}
	bad := req
	bad.Ports = []EditPort{{HostPort: "99999", ContainerPort: "80", Protocol: "tcp"}}
	if err := validateRecreateRequest(&bad); err == nil {
		t.Fatal("expected invalid host port")
	}
}

func TestEditSpecDetectsCompose(t *testing.T) {
	inspect := rawContainerInspect{ID: "abcdef123456", Name: "/web"}
	inspect.State.Running = true
	inspect.Config = map[string]any{
		"Image": "nginx:latest",
		"Labels": map[string]any{
			"com.docker.compose.project":              "demo",
			"com.docker.compose.service":              "web",
			"com.docker.compose.project.config_files": "/opt/demo/compose.yaml",
		},
	}
	inspect.HostConfig = map[string]any{"RestartPolicy": map[string]any{"Name": "unless-stopped", "MaximumRetryCount": float64(0)}}
	spec := editSpecFromInspect(inspect)
	if !spec.ComposeManaged || spec.ComposeProject != "demo" || len(spec.ComposeFiles) != 1 {
		t.Fatalf("unexpected compose spec: %#v", spec)
	}
}
