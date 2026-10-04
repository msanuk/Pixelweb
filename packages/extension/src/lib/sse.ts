/**
 * Splits a text/event-stream into each event's `data`. Comments (the server's
 * `: ping`) and other fields are dropped; a multi-line data field is joined
 * with newlines, as EventSource does.
 */
export function sseParser(onData: (data: string) => void): (chunk: string) => void {
  let buf = '';
  return (chunk) => {
    // a "\r\n" can be split across chunks: normalise the whole buffer, a lone trailing "\r" waits for its "\n"
    buf = (buf + chunk).replace(/\r\n/g, '\n');
    let end: number;
    while ((end = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, end);
      buf = buf.slice(end + 2);
      const data = frame
        .split('\n')
        .filter((l) => l === 'data' || l.startsWith('data:'))
        .map((l) => l.slice(5).replace(/^ /, ''));
      if (data.length) onData(data.join('\n'));
    }
  };
}
