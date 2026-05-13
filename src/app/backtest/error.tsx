import React from 'react';
export default function ErrorBacktest({error}:{error?:Error}){return <div><h3>Backtest error</h3><p>{error?.message ?? 'retry'}</p></div>}