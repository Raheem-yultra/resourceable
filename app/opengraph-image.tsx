import { ImageResponse } from 'next/og';

// Generated at build time rather than shipped as a static asset, so the wording
// stays in sync with the site instead of drifting inside a PNG nobody re-exports.
export const alt = 'ResourceAble — find trusted disability services near you';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #0f2027 0%, #16394a 55%, #1f6f8b 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 2, opacity: 0.75, textTransform: 'uppercase' }}>
          Disability services directory
        </div>
        <div style={{ fontSize: 92, fontWeight: 700, marginTop: 24, lineHeight: 1.05 }}>
          ResourceAble
        </div>
        <div style={{ fontSize: 40, marginTop: 28, opacity: 0.9, lineHeight: 1.3 }}>
          Find trusted, verified providers in your community.
        </div>
      </div>
    ),
    size
  );
}
