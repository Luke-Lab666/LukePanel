function base64URLToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const raw = atob(padded);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

function bytesToBase64URL(value: ArrayBuffer | ArrayBufferView | null) {
  if (!value) return '';
  const bytes = value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function publicKeyRequestOptions(input: Record<string, any>): PublicKeyCredentialRequestOptions {
  return {
    challenge: base64URLToBytes(String(input.challenge)),
    rpId: input.rp_id ? String(input.rp_id) : undefined,
    timeout: Number(input.timeout ?? 60000),
    userVerification: input.user_verification ?? 'preferred',
    allowCredentials: (input.allow_credentials ?? []).map((item: Record<string, any>) => ({
      type: 'public-key',
      id: base64URLToBytes(String(item.id)),
      transports: item.transports,
    })),
  };
}

export function publicKeyCreationOptions(input: Record<string, any>): PublicKeyCredentialCreationOptions {
  return {
    challenge: base64URLToBytes(String(input.challenge)),
    rp: { name: String(input.rp?.name ?? 'LukePanel'), id: input.rp?.id ? String(input.rp.id) : undefined },
    user: {
      id: base64URLToBytes(String(input.user?.id)),
      name: String(input.user?.name ?? ''),
      displayName: String(input.user?.display_name ?? input.user?.name ?? ''),
    },
    pubKeyCredParams: (input.pub_key_cred_params ?? [{ type: 'public-key', alg: -7 }]).map((item: Record<string, any>) => ({ type: 'public-key', alg: Number(item.alg) })),
    timeout: Number(input.timeout ?? 60000),
    attestation: input.attestation ?? 'none',
    authenticatorSelection: input.authenticator_selection ? {
      residentKey: input.authenticator_selection.resident_key,
      userVerification: input.authenticator_selection.user_verification,
      authenticatorAttachment: input.authenticator_selection.authenticator_attachment,
    } : undefined,
    excludeCredentials: (input.exclude_credentials ?? []).map((item: Record<string, any>) => ({ type: 'public-key', id: base64URLToBytes(String(item.id)) })),
  };
}

export function serializeAssertion(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    raw_id: bytesToBase64URL(credential.rawId),
    type: credential.type,
    response: {
      authenticator_data: bytesToBase64URL(response.authenticatorData),
      client_data_json: bytesToBase64URL(response.clientDataJSON),
      signature: bytesToBase64URL(response.signature),
      user_handle: bytesToBase64URL(response.userHandle),
    },
    client_extension_results: credential.getClientExtensionResults(),
  };
}

export function serializeCreation(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    raw_id: bytesToBase64URL(credential.rawId),
    type: credential.type,
    response: {
      attestation_object: bytesToBase64URL(response.attestationObject),
      client_data_json: bytesToBase64URL(response.clientDataJSON),
      transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
    },
    client_extension_results: credential.getClientExtensionResults(),
  };
}
