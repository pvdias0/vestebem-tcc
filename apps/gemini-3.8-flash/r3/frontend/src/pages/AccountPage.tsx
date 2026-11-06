import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api, type UpdateAddressPayload } from '../services/api.js';

interface AccountPageProps {
  onLoggedOut: () => void;
  onAddressUpdated?: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({ onLoggedOut, onAddressUpdated }) => {
  const { user, logout, refreshUser } = useAuth();

  // Estados dos formulários de dados pessoais
  const [name, setName] = useState(user?.name || '');
  const [cpf, setCpf] = useState(user?.cpf || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estados do formulário de endereço de entrega
  const [recipientName, setRecipientName] = useState(user?.address?.recipientName || user?.name || '');
  const [cep, setCep] = useState(user?.address?.cep || '');
  const [street, setStreet] = useState(user?.address?.street || '');
  const [number, setNumber] = useState(user?.address?.number || '');
  const [complement, setComplement] = useState(user?.address?.complement || '');
  const [neighborhood, setNeighborhood] = useState(user?.address?.neighborhood || '');
  const [city, setCity] = useState(user?.address?.city || '');
  const [state, setState] = useState(user?.address?.state || '');
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressMsg, setAddressMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estados do formulário de alteração de senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!user) {
    return null;
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    if (!name.trim()) {
      setProfileMsg({ type: 'error', text: 'O nome não pode estar vazio.' });
      return;
    }

    try {
      setProfileLoading(true);
      const res = await api.updateProfile({
        name: name.trim(),
        cpf: cpf.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      await refreshUser();
      setProfileMsg({ type: 'success', text: res.message });
      setTimeout(() => setProfileMsg(null), 4000);
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Erro ao atualizar dados pessoais.' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressMsg(null);

    const payload: UpdateAddressPayload = {
      recipientName: recipientName.trim(),
      cep: cep.trim(),
      street: street.trim(),
      number: number.trim(),
      complement: complement.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim(),
    };

    if (!payload.recipientName || !payload.cep || !payload.street || !payload.number || !payload.neighborhood || !payload.city || !payload.state) {
      setAddressMsg({ type: 'error', text: 'Por favor, preencha todos os campos obrigatórios do endereço.' });
      return;
    }

    try {
      setAddressLoading(true);
      const res = await api.updateAddress(payload);
      await refreshUser();
      setAddressMsg({ type: 'success', text: res.message });
      if (onAddressUpdated) onAddressUpdated();
      setTimeout(() => setAddressMsg(null), 4000);
    } catch (err: any) {
      setAddressMsg({ type: 'error', text: err.message || 'Erro ao atualizar endereço.' });
    } finally {
      setAddressLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (!currentPassword) {
      setPasswordMsg({ type: 'error', text: 'Informe a senha atual.' });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'A nova senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'A confirmação da nova senha não confere.' });
      return;
    }

    try {
      setPasswordLoading(true);
      const res = await api.changePassword(currentPassword, newPassword);
      setPasswordMsg({ type: 'success', text: res.message });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg(null), 4000);
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Erro ao alterar senha.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="page-card max-w-4xl">
      <div className="account-header">
        <div className="account-avatar">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2>Minha conta</h2>
          <p className="account-subtitle">
            {user.role === 'employee' ? 'Painel de gerenciamento do funcionário' : 'Painel de gerenciamento do cliente'}
          </p>
        </div>
      </div>

      <div className="account-details-grid">
        {/* Bloco 1: Dados Pessoais */}
        <div className="account-section-card">
          <h3 className="section-title">1. Dados Pessoais</h3>
          <p className="section-desc">Consulte e atualize seu nome, CPF e telefone de contato.</p>

          {profileMsg && (
            <div className={`alert ${profileMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleUpdateProfile} noValidate>
            <div className="form-group">
              <label>Nome completo</label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={profileLoading}
                required
              />
            </div>

            <div className="form-group">
              <label>E-mail (Login)</label>
              <input
                type="email"
                className="form-control"
                value={user.email}
                disabled
              />
              <span className="text-xs text-muted">O e-mail identifica sua conta de forma única.</span>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>CPF</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  disabled={profileLoading}
                />
                <span className="text-xs text-muted">Seu CPF fica visível apenas para você.</span>
              </div>

              <div className="form-group">
                <label>Telefone / WhatsApp</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={profileLoading}
                />
              </div>
            </div>

            <div className="form-actions-bar mt-4">
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={profileLoading}
              >
                {profileLoading ? 'Salvando dados...' : 'Salvar dados pessoais'}
              </button>
            </div>
          </form>
        </div>

        {/* Bloco 2: Endereço de Entrega */}
        <div className="account-section-card">
          <h3 className="section-title">2. Endereço de Entrega</h3>
          <p className="section-desc">Necessário para envio dos seus pedidos de compra.</p>

          {addressMsg && (
            <div className={`alert ${addressMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
              {addressMsg.text}
            </div>
          )}

          <form onSubmit={handleUpdateAddress} noValidate>
            <div className="form-group">
              <label>Nome do destinatário</label>
              <input
                type="text"
                className="form-control"
                placeholder="Nome da pessoa que receberá a encomenda"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                disabled={addressLoading}
                required
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>CEP</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  disabled={addressLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label>Bairro</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Bairro"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  disabled={addressLoading}
                  required
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Logradouro (Rua, Av, etc.)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nome da rua ou avenida"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  disabled={addressLoading}
                  required
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Número</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: 123"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  disabled={addressLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label>Complemento (opcional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Apto, Bloco, Casa 2"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                  disabled={addressLoading}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Cidade</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Cidade"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={addressLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label>Estado (UF)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: SP, RJ, MG"
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  disabled={addressLoading}
                  required
                />
              </div>
            </div>

            <div className="form-actions-bar mt-4">
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={addressLoading}
              >
                {addressLoading ? 'Salvando endereço...' : 'Salvar endereço de entrega'}
              </button>
            </div>
          </form>
        </div>

        {/* Bloco 3: Alteração de Senha */}
        <div className="account-section-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="section-title">3. Segurança e Senha</h3>
          <p className="section-desc">Altere sua senha de acesso informando a senha atual para validação.</p>

          {passwordMsg && (
            <div className={`alert ${passwordMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
              {passwordMsg.text}
            </div>
          )}

          <form onSubmit={handleChangePassword} noValidate>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Senha atual</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Digite sua senha atual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={passwordLoading}
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="form-group">
                <label>Nova senha</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={passwordLoading}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label>Confirmação da nova senha</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={passwordLoading}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="form-actions-bar mt-4">
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={passwordLoading}
              >
                {passwordLoading ? 'Alterando senha...' : 'Atualizar senha'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="account-actions mt-6">
        <button
          type="button"
          className="btn btn-danger"
          onClick={async () => {
            await logout();
            onLoggedOut();
          }}
        >
          Sair da conta
        </button>
      </div>
    </div>
  );
};
