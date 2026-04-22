import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface NotificationTemplate {
  id: string;
  type: string;
  subject_template: string;
  body_template: string;
  mandatory_placeholders: string[];
}

export default function NotificationTemplates() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function loadTemplates() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get('/notifications/templates');
      setTemplates(response.data.data ?? []);
    } catch (err) {
      console.error('Falha ao carregar templates', err);
      setError('Não foi possível carregar os templates.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleEditClick = (template: NotificationTemplate) => {
    setEditingId(template.id);
    setEditSubject(template.subject_template);
    setEditBody(template.body_template);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditSubject('');
    setEditBody('');
  };

  const handleSave = async (id: string) => {
    setIsSaving(true);
    try {
      await api.put(`/notifications/templates/${id}`, {
        subject_template: editSubject,
        body_template: editBody,
      });
      alert('Template atualizado com sucesso!');
      setEditingId(null);
      loadTemplates();
    } catch (err: any) {
      console.error('Falha ao salvar template', err);
      alert(err.response?.data?.message || 'Falha ao salvar template');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Templates de Notificação</h1>
          <p style={{ color: 'var(--color-gray-500)', maxWidth: 720 }}>
            Gerencie o assunto e o corpo dos e-mails enviados pelo sistema.
          </p>
        </div>
      </div>

      {error ? (
        <div style={{ padding: '1.5rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px' }}>
          {error}
        </div>
      ) : isLoading ? (
        <div style={{ padding: '1.5rem', color: 'var(--color-gray-500)' }}>
          Carregando templates...
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '2rem' }}>
          {templates.map((template) => {
            const isEditing = editingId === template.id;

            return (
              <div
                key={template.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-color)',
                  padding: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1.25rem' }}>{template.type}</h2>
                  {!isEditing && (
                    <button className="btn btn-secondary" onClick={() => handleEditClick(template)}>
                      Editar Template
                    </button>
                  )}
                </div>

                <div style={{ marginBottom: '1rem', color: 'var(--color-gray-500)', fontSize: '0.875rem' }}>
                  <strong>Variáveis obrigatórias:</strong>{' '}
                  {template.mandatory_placeholders.map((p) => `{{${p}}}`).join(', ')}
                </div>

                {isEditing ? (
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                        Assunto
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                        Corpo (HTML permitido)
                      </label>
                      <textarea
                        className="input"
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        style={{ width: '100%', minHeight: '200px', fontFamily: 'monospace' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" onClick={handleCancelEdit} disabled={isSaving}>
                        Cancelar
                      </button>
                      <button className="btn btn-primary" onClick={() => handleSave(template.id)} disabled={isSaving}>
                        {isSaving ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <div>
                      <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Assunto:</strong>
                      <div style={{ padding: '0.75rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                        {template.subject_template}
                      </div>
                    </div>
                    <div>
                      <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Corpo:</strong>
                      <div style={{ padding: '0.75rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                        {template.body_template}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
