package server

import (
	"context"
	"github.com/Luke-Lab666/LukePanel/internal/auth"
)

type sessionKey struct{}

func withSession(ctx context.Context, session auth.Session) context.Context {
	return context.WithValue(ctx, sessionKey{}, session)
}
func sessionFromContext(r interface{ Context() context.Context }) (auth.Session, bool) {
	s, ok := r.Context().Value(sessionKey{}).(auth.Session)
	return s, ok
}
