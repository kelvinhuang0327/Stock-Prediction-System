'use client';

import React from 'react';

export default function ErrorPage({ error }: { error?: Error }) {
  return (
    <div style={{padding:24}}>
      <h2>Something went wrong</h2>
      <p>{error?.message ?? 'Unknown error'}</p>
      <button onClick={() => location.reload()}>Retry</button>
    </div>
  );
}
