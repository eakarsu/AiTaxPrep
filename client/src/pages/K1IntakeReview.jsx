import React, { useEffect, useState } from 'react';

export default function K1IntakeReview() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/k1-intake-review', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData({ error: 'Unable to load K-1 intake review.' }));
  }, []);

  if (!data) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h1>K-1 Intake Review</h1>
        <p>Partnership and S-corp intake checks for basis, passive loss, and QBI detail.</p>
      </div>
      <div className="grid grid-4">
        <div className="stat-card"><div className="stat-value">{data.summary?.formsReceived}</div><div className="stat-label">Forms Received</div></div>
        <div className="stat-card"><div className="stat-value">{data.summary?.missingBasis}</div><div className="stat-label">Missing Basis</div></div>
        <div className="stat-card"><div className="stat-value">${data.summary?.passiveLossAtRisk?.toLocaleString()}</div><div className="stat-label">Passive Loss at Risk</div></div>
        <div className="stat-card"><div className="stat-value">{data.summary?.reviewStatus}</div><div className="stat-label">Status</div></div>
      </div>
      <div className="card">
        <h2>Entity Review</h2>
        <table className="data-table">
          <thead><tr><th>Entity</th><th>Box</th><th>Amount</th><th>Issue</th></tr></thead>
          <tbody>{data.entities?.map((entity) => (
            <tr key={entity.name}><td>{entity.name}</td><td>{entity.box}</td><td>${entity.amount.toLocaleString()}</td><td>{entity.issue}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <div className="card">
        <h2>Checklist</h2>
        <ul>{data.checklist?.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    </div>
  );
}
