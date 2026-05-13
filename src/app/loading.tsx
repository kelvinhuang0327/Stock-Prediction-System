import React from 'react';

export default function Loading() {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div role="status" aria-label="loading-spinner">🔄 Loading…</div>
    </div>
  );
}
