import React, { useState } from 'react';
import { User } from './types';
import { apiLogout, apiUpdatePersonalInfo, apiUpdateAddress, apiChangePassword } from './api';

interface AccountProps {
  user: User;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
  onGoToOrders?: () => void;
  onGoToEmployeePanel?: () => void;
}

export const AccountPage: React.FC<AccountProps> = ({
  user,
  onUserUpdated,
  onLogout,
  onGoToOrders,
  onGoToEmployeePanel
}) => {
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'personal' | 'address' | 'password'>('profile');

  // Estados dos formulários
  const [personalName, setPersonalName] = useState(user.name);
  const [personalCpf, setPersonalCpf] = useState(user.cpf || '');
  const [personalPhone, setPersonalPhone] = useState(user.phone || '');

  const [addressRecipient, setAddressRecipient] = useState(user.recipient_name || user.name);
  const [addressCep, setAddressCep] = useState(user.cep || '');
  const [addressStreet, setAddressStreet] = useState(user.street || '');
  const [addressNumber, setAddressNumber] = useState(user.number || '');
  const [addressComplement, setAddressComplement] = useState(user.complement || '');
  const [addressNeighborhood, setAddressNeighborhood] = useState(user.neighborhood || '');
  const [addressCity, setAddressCity] = useState(user.city || '');
  const [addressState, setAddressState] = useState(user.state || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isEmployee = user.role === 'employee';

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      setError(null);
      await apiLogout();
      onLogout();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao deslogar da conta.');
      }
      setLoggingOut(false);
    }
  };

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!personalName.trim()) {
      setError('O nome é obrigatório.');
      return;
    }

    try {
      setSaving(true);
      const updated = await apiUpdatePersonalInfo({
        name: personalName.trim(),
        cpf: personalCpf.trim() || undefined,
        phone: personalPhone.trim() || undefined
      });
      onUserUpdated(updated);
      setSuccess('Dados pessoais atualizados com sucesso!');
      setActiveTab('profile');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao salvar dados pessoais.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (
      !addressRecipient.trim() ||
      !addressCep.trim() ||
      !addressStreet.trim() ||
      !addressNumber.trim() ||
      !addressNeighborhood.trim() ||
      !addressCity.trim() ||
      !addressState.trim()
    ) {
      setError('Por favor, preencha todos os campos obrigatórios do endereço.');
      return;
    }

    try {
      setSaving(true);
      const updated = await apiUpdateAddress({
        recipient_name: addressRecipient.trim(),
        cep: addressCep.trim(),
        street: addressStreet.trim(),
        number: addressNumber.trim(),
        complement: addressComplement.trim() || undefined,
        neighborhood: addressNeighborhood.trim(),
        city: addressCity.trim(),
        state: addressState.trim().toUpperCase()
      });
      onUserUpdated(updated);
      setSuccess('Endereço de entrega salvo com sucesso!');
      setActiveTab('profile');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao salvar endereço.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword) {
      setError('Informe a senha atual e a nova senha.');
      return;
    }

    if (newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação da nova senha não confere.');
      return;
    }

    try {
      setSaving(true);
      await apiChangePassword({ currentPassword, newPassword });
      setSuccess('Senha alterada com sucesso! Utilize-a em seu próximo login.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActiveTab('profile');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao alterar senha.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="account-card" style={{ maxWidth: '680px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h2 className="card-title">Minha Conta</h2>
        <span className={`role-tag ${isEmployee ? 'role-employee' : 'role-customer'}`}>
          {isEmployee ? 'Funcionário' : 'Cliente'}
        </span>
      </div>
      <p className="card-subtitle">Gerencie suas informações de acesso e entrega na VesteBem</p>

      {/* Abas de Navegação interna da conta */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`nav-btn ${activeTab === 'profile' ? 'primary' : 'secondary'}`}
          onClick={() => { setActiveTab('profile'); setError(null); }}
        >
          Visão Geral
        </button>
        <button
          type="button"
          className={`nav-btn ${activeTab === 'personal' ? 'primary' : 'secondary'}`}
          onClick={() => {
            setActiveTab('personal');
            setPersonalName(user.name);
            setPersonalCpf(user.cpf || '');
            setPersonalPhone(user.phone || '');
            setError(null);
          }}
        >
          Dados Pessoais
        </button>
        <button
          type="button"
          className={`nav-btn ${activeTab === 'address' ? 'primary' : 'secondary'}`}
          onClick={() => {
            setActiveTab('address');
            setAddressRecipient(user.recipient_name || user.name);
            setAddressCep(user.cep || '');
            setAddressStreet(user.street || '');
            setAddressNumber(user.number || '');
            setAddressComplement(user.complement || '');
            setAddressNeighborhood(user.neighborhood || '');
            setAddressCity(user.city || '');
            setAddressState(user.state || '');
            setError(null);
          }}
        >
          Endereço de Entrega
        </button>
        <button
          type="button"
          className={`nav-btn ${activeTab === 'password' ? 'primary' : 'secondary'}`}
          onClick={() => { setActiveTab('password'); setError(null); }}
        >
          Alterar Senha
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Aba 1: Visão Geral */}
      {activeTab === 'profile' && (
        <>
          <div className="account-info-list">
            <div className="info-item">
              <div className="info-label">Nome Completo</div>
              <div className="info-value">{user.name}</div>
            </div>

            <div className="info-item">
              <div className="info-label">E-mail</div>
              <div className="info-value">{user.email}</div>
            </div>

            <div className="info-item">
              <div className="info-label">CPF (Exclusivo da sua conta)</div>
              <div className="info-value">{user.cpf || 'Não informado'}</div>
            </div>

            <div className="info-item">
              <div className="info-label">Telefone de Contato</div>
              <div className="info-value">{user.phone || 'Não informado'}</div>
            </div>

            <div className="info-item">
              <div className="info-label">Endereço de Entrega Cadastrado</div>
              <div className="info-value" style={{ fontSize: '0.95rem' }}>
                {user.street ? (
                  <div>
                    <strong>Destinatário:</strong> {user.recipient_name || user.name}<br />
                    {user.street}, {user.number} {user.complement ? `(${user.complement})` : ''}<br />
                    {user.neighborhood} - {user.city}/{user.state}<br />
                    CEP: {user.cep}
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>
                    Nenhum endereço cadastrado. Cadastre para poder realizar pedidos.
                  </span>
                )}
              </div>
            </div>

            <div className="info-item">
              <div className="info-label">Tipo de Perfil</div>
              <div className="info-value">
                {isEmployee ? 'Funcionário (Acesso ao Painel)' : 'Cliente'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              {isEmployee ? (
                onGoToEmployeePanel && (
                  <button type="button" className="nav-btn primary" onClick={onGoToEmployeePanel}>
                    Ir para Painel de Pedidos
                  </button>
                )
              ) : (
                onGoToOrders && (
                  <button type="button" className="nav-btn primary" onClick={onGoToOrders}>
                    Ver Meus Pedidos
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              className="nav-btn danger"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? 'Saindo...' : 'Sair da conta'}
            </button>
          </div>
        </>
      )}

      {/* Aba 2: Editar Dados Pessoais */}
      {activeTab === 'personal' && (
        <form onSubmit={handleSavePersonal}>
          <div className="form-group">
            <label className="form-label">Nome Completo *</label>
            <input
              type="text"
              className="form-input"
              value={personalName}
              onChange={(e) => setPersonalName(e.target.value)}
              disabled={saving}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">CPF (visível somente para você)</label>
            <input
              type="text"
              className="form-input"
              placeholder="000.000.000-00"
              value={personalCpf}
              onChange={(e) => setPersonalCpf(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Telefone de Contato</label>
            <input
              type="text"
              className="form-input"
              placeholder="(XX) 9XXXX-XXXX"
              value={personalPhone}
              onChange={(e) => setPersonalPhone(e.target.value)}
              disabled={saving}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="nav-btn secondary"
              onClick={() => setActiveTab('profile')}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="nav-btn primary"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar Dados Pessoais'}
            </button>
          </div>
        </form>
      )}

      {/* Aba 3: Cadastrar / Atualizar Endereço */}
      {activeTab === 'address' && (
        <form onSubmit={handleSaveAddress}>
          <div className="form-group">
            <label className="form-label">Nome do Destinatário *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Quem vai receber as encomendas"
              value={addressRecipient}
              onChange={(e) => setAddressRecipient(e.target.value)}
              disabled={saving}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">CEP *</label>
              <input
                type="text"
                className="form-input"
                placeholder="00000-000"
                value={addressCep}
                onChange={(e) => setAddressCep(e.target.value)}
                disabled={saving}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Logradouro / Rua *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Rua, Avenida, Praça..."
                value={addressStreet}
                onChange={(e) => setAddressStreet(e.target.value)}
                disabled={saving}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Número *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: 123 ou S/N"
                value={addressNumber}
                onChange={(e) => setAddressNumber(e.target.value)}
                disabled={saving}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Complemento (opcional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Apto 42, Bloco B, Casa 2..."
                value={addressComplement}
                onChange={(e) => setAddressComplement(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Bairro *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Bairro"
                value={addressNeighborhood}
                onChange={(e) => setAddressNeighborhood(e.target.value)}
                disabled={saving}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Cidade *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Cidade"
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                disabled={saving}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Estado *</label>
              <input
                type="text"
                className="form-input"
                placeholder="UF"
                maxLength={2}
                value={addressState}
                onChange={(e) => setAddressState(e.target.value.toUpperCase())}
                disabled={saving}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="nav-btn secondary"
              onClick={() => setActiveTab('profile')}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="nav-btn primary"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar Endereço'}
            </button>
          </div>
        </form>
      )}

      {/* Aba 4: Alterar Senha */}
      {activeTab === 'password' && (
        <form onSubmit={handleSavePassword}>
          <div className="form-group">
            <label className="form-label">Senha Atual *</label>
            <input
              type="password"
              className="form-input"
              placeholder="Digite sua senha atual"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={saving}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Nova Senha * (mínimo 6 caracteres)</label>
            <input
              type="password"
              className="form-input"
              placeholder="Digite a nova senha"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={saving}
              minLength={6}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirmar Nova Senha *</label>
            <input
              type="password"
              className="form-input"
              placeholder="Confirme a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={saving}
              minLength={6}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="nav-btn secondary"
              onClick={() => setActiveTab('profile')}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="nav-btn primary"
              disabled={saving}
            >
              {saving ? 'Alterando...' : 'Confirmar Alteração de Senha'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
