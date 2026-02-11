'use client';

import { useState } from 'react';
import './styles.css';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface EncryptedRecord {
  id: string;
  partyId: string;
  createdAt: string;
  payload_nonce: string;
  payload_ct: string;
  payload_tag: string;
  dek_wrap_nonce: string;
  dek_wrapped: string;
  dek_wrap_tag: string;
  alg: string;
  mk_version: number;
}

interface DecryptedResponse {
  payload: unknown;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Home() {
  // ------------------------------------------------------------------------
  // STATE MANAGEMENT
  // ------------------------------------------------------------------------
  
  // Encryption form state
  const [partyId, setPartyId] = useState('');
  const [payloadJson, setPayloadJson] = useState('');
  const [encryptLoading, setEncryptLoading] = useState(false);
  const [encryptedRecord, setEncryptedRecord] = useState<EncryptedRecord | null>(null);
  
  // Transaction form state
  const [txId, setTxId] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [decryptLoading, setDecryptLoading] = useState(false);
  const [fetchedRecord, setFetchedRecord] = useState<EncryptedRecord | null>(null);
  const [decryptedPayload, setDecryptedPayload] = useState<unknown | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState<EncryptedRecord | null>(null);

  // Messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ------------------------------------------------------------------------
  // API BASE URL
  // ------------------------------------------------------------------------
  const API_BASE = 'http://localhost:3001';

  // ------------------------------------------------------------------------
  // HANDLER: ENCRYPT & SAVE
  // ------------------------------------------------------------------------
  const handleEncrypt = async () => {
    setError('');
    setSuccess('');
    setEncryptedRecord(null);
    
    if (!partyId.trim()) {
      setError('Party ID is required');
      return;
    }
    
    let payload: unknown;
    try {
      payload = JSON.parse(payloadJson);
    } catch (err) {
      setError('Invalid JSON format');
      return;
    }
    
    setEncryptLoading(true);
    try {
      const response = await fetch(`${API_BASE}/tx/encrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partyId, payload })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Encryption failed');
        return;
      }
      
      setEncryptedRecord(data);
      setTxId(data.id); // Auto-fill for convenience
      setSuccess('Encryption successful! Record stored securely.');
      setModalContent(data);
      setShowModal(true);
    } catch (err) {
      setError('Network error: Unable to connect to API');
    } finally {
      setEncryptLoading(false);
    }
  };

  // ------------------------------------------------------------------------
  // HANDLER: FETCH ENCRYPTED RECORD
  // ------------------------------------------------------------------------
  const handleFetch = async () => {
    setError('');
    setSuccess('');
    setFetchedRecord(null);
    setDecryptedPayload(null);
    
    if (!txId.trim()) {
      setError('Transaction ID is required');
      return;
    }
    
    setFetchLoading(true);
    try {
      const response = await fetch(`${API_BASE}/tx/${txId}`);
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Failed to fetch transaction');
        return;
      }
      
      setFetchedRecord(data);
      setSuccess('Transaction retrieved successfully');
    } catch (err) {
      setError('Network error: Unable to connect to API');
    } finally {
      setFetchLoading(false);
    }
  };

  // ------------------------------------------------------------------------
  // HANDLER: DECRYPT TRANSACTION
  // ------------------------------------------------------------------------
  const handleDecrypt = async () => {
    setError('');
    setSuccess('');
    setDecryptedPayload(null);
    
    if (!txId.trim()) {
      setError('Transaction ID is required');
      return;
    }
    
    setDecryptLoading(true);
    try {
      const response = await fetch(`${API_BASE}/tx/${txId}/decrypt`, {
        method: 'POST'
      });
      
      const data: DecryptedResponse | { error: string } = await response.json();
      
      if (!response.ok) {
        setError((data as { error: string }).error || 'Decryption failed');
        return;
      }
      
      setDecryptedPayload((data as DecryptedResponse).payload);
      setSuccess('Transaction decrypted successfully');
    } catch (err) {
      setError('Network error: Unable to connect to API');
    } finally {
      setDecryptLoading(false);
    }
  };

  // ------------------------------------------------------------------------
  // HANDLER: COPY TRANSACTION ID
  // ------------------------------------------------------------------------
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('Transaction ID copied to clipboard');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  // ------------------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------------------
  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <h1 className="title">Secure Transaction Vault</h1>
        <p className="subtitle">
          Envelope Encryption <span className="badge">AES-256-GCM</span>
        </p>
      </header>

      {/* ERROR/SUCCESS MESSAGES */}
      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      {/* MAIN CONTENT - TWO COLUMN LAYOUT */}
      <div className="main-grid">
        
        {/* LEFT COLUMN: ENCRYPT & STORE */}
        <section className="card">
          <h2 className="card-title">Encrypt & Store</h2>
          
          <div className="form-group">
            <div className="label-row">
              <label htmlFor="partyId" className="label">Party ID</label>
            </div>
            <input
              id="partyId"
              type="text"
              className="input"
              placeholder="e.g., user_12345"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              disabled={encryptLoading}
            />
          </div>

          <div className="form-group">
            <div className="label-row">
              <label htmlFor="payload" className="label">JSON Payload</label>
              <button 
                className="label-action"
                onClick={() => setPayloadJson('{\n  "amount": 5000,\n  "currency": "USD",\n  "description": "Confidential transfer",\n  "status": "pending"\n}')}
              >
                Load Example
              </button>
            </div>
            <textarea
              id="payload"
              className="textarea"
              placeholder={'{\n  "key": "value"\n}'}
              value={payloadJson}
              onChange={(e) => setPayloadJson(e.target.value)}
              disabled={encryptLoading}
              rows={6}
            />
          </div>

          <button
            className="button primary"
            onClick={handleEncrypt}
            disabled={encryptLoading}
          >
            {encryptLoading ? 'Encrypting...' : 'Encrypt & Save'}
          </button>

          {/* ENCRYPTED RECORD DISPLAY */}
          {encryptedRecord ? (
            <div className="result-box">
              <div className="result-summary">
                <div className="summary-row">
                  <span className="summary-label">Transaction ID</span>
                  <span className="summary-value">{encryptedRecord.id.slice(0, 12)}...</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Party ID</span>
                  <span className="summary-value">{encryptedRecord.partyId}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Algorithm</span>
                  <span className="summary-value">{encryptedRecord.alg}</span>
                </div>
              </div>
              
              <button 
                className="button secondary view-btn"
                onClick={() => {
                  setModalContent(encryptedRecord);
                  setShowModal(true);
                }}
              >
                View Full Secure Record
              </button>
            </div>
          ) : null}
        </section>

        {/* RIGHT COLUMN: RETRIEVE & DECRYPT */}
        <section className="card">
          <h2 className="card-title">Retrieve & Decrypt</h2>
          
          <div className="form-group">
            <label htmlFor="txId" className="label">Transaction ID</label>
            <input
              id="txId"
              type="text"
              className="input"
              placeholder="Enter transaction ID"
              value={txId}
              onChange={(e) => setTxId(e.target.value)}
              disabled={fetchLoading || decryptLoading}
            />
          </div>

          <div className="button-group">
            <button
              className="button secondary"
              onClick={handleFetch}
              disabled={fetchLoading || decryptLoading}
            >
              {fetchLoading ? 'Fetching...' : 'Fetch Encrypted'}
            </button>
            <button
              className="button primary"
              onClick={handleDecrypt}
              disabled={fetchLoading || decryptLoading}
            >
              {decryptLoading ? 'Decrypting...' : 'Decrypt'}
            </button>
          </div>

          {/* FETCHED RECORD DISPLAY */}
          {fetchedRecord ? (
            <div className="result-box">
              <div className="result-header">
                <span className="result-title">Encrypted Record</span>
              </div>
              <pre className="json-output">
                {JSON.stringify(fetchedRecord, null, 2)}
              </pre>
            </div>
          ) : null}

          {/* DECRYPTED PAYLOAD DISPLAY */}
          {decryptedPayload ? (
            <div className="result-box decrypted">
              <div className="result-header">
                <span className="result-title">Decrypted Payload</span>
              </div>
              <pre className="json-output">
                {JSON.stringify(decryptedPayload, null, 2)}
              </pre>
            </div>
          ) : null}
        </section>
      </div>

      {/* MODAL */}
      {showModal && modalContent && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Encrypted Record Details</h3>
              <button 
                className="close-btn"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-content">
              <pre className="json-output">
                {JSON.stringify(modalContent, null, 2)}
              </pre>
            </div>

            <div className="modal-footer">
              <button 
                className="button secondary" 
                style={{ width: 'auto' }}
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
              <button 
                className="button primary" 
                style={{ width: 'auto' }}
                onClick={() => {
                  handleCopy(JSON.stringify(modalContent, null, 2));
                  setSuccess('Full record copied to clipboard!');
                }}
              >
                Copy JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="footer">
        <p>Mirfa Secure Transaction Vault • Enterprise Grade Security</p>
      </footer>
    </div>
  );
}
