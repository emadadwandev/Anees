import { describe, expect, it } from '@jest/globals';
import { MetricsService } from './metrics.service';

describe('MetricsService TCP metrics', () => {
  it('exports bounded TCP connection, frame, rejection, and duration metrics', async () => {
    const metrics = new MetricsService();
    metrics.tcpConnectionsActive.set({ protocol: 'wavve' }, 1);
    metrics.tcpFramesReceived.inc({ protocol: 'wavve', function_code: '0x03e8' });
    metrics.tcpFramesRejected.inc({ protocol: 'assure', reason: 'invalid_frame' });
    metrics.tcpHandlerDuration.observe({ protocol: 'wavve', function_code: '0x03e8' }, 0.02);

    const output = await metrics.registry.metrics();
    expect(output).toContain('anees_tcp_connections_active{protocol="wavve"} 1');
    expect(output).toContain('anees_tcp_frames_received_total{protocol="wavve",function_code="0x03e8"} 1');
    expect(output).toContain('anees_tcp_frames_rejected_total{protocol="assure",reason="invalid_frame"} 1');
    expect(output).toContain('anees_tcp_handler_duration_seconds');
  });
});
