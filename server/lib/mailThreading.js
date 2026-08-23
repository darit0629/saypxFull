function buildReplyHeaders(original) {
  const references = [original.references_header, original.message_id].filter(Boolean).join(' ');
  return {
    inReplyTo: original.message_id || undefined,
    references: references || undefined,
  };
}

function buildReplySubject(subject) {
  const s = subject || '(no subject)';
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

function buildForwardSubject(subject) {
  const s = subject || '(no subject)';
  return /^fwd:/i.test(s) ? s : `Fwd: ${s}`;
}

module.exports = { buildReplyHeaders, buildReplySubject, buildForwardSubject };
