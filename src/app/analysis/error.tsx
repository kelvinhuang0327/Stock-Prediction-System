import React from 'react';
export default function ErrorAnalysis({error}:{error?:Error}){return <div><h3>Analysis error</h3><p>{error?.message ?? 'retry'}</p></div>}