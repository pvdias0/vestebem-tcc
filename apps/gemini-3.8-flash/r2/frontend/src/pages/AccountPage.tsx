import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ActiveView } from '../types';
import { ApiError } from '../services/api';

interface AccountPageProps {
  onNavigate: (view: ActiveView) => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({ onNavigate }) => {
  const { user, logoutUser, updateProfile, updateAddress, changePassword } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  // Estados dos Dados Pessoais
  const [name, setName] = useState(user?.name || '');
  const [cpf, setCpf] = useState(user?.cpf || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Estados do Endereço de Entrega
  const [recipient, setRecipient] = useState(user?.address?.recipient || user?.name || '');
  const [zipCode, setZipCode] = useState(user?.address?.zip_code || '');
  const [street, setStreet] = useState(user?.address?.street || '');
  const [number, setNumber] = useState(user?.address?.number || '');
  const [complement, setComplement] = useState(user?.address?.complement || '');
  const [neighborhood, setNeighborhood] = useState(user?.address?.neighborhood || '');
  const [city, setCity] = useState(user?.address?.city || '');
  const [state, setState] = useState(user?.address?.state || '');
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressSuccess, setAddressSuccess] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Estados da Alteração de Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logoutUser();
    } finally {
      setLoggingOut(false);
    }
  };

  // Salvar Dados Pessoais
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!name.trim()) {
      setProfileError('O nome completo é obrigatório.');
      return;
    }

    try {
      setSavingProfile(true);
      await updateProfile({
        name: name.trim(),
        cpf: cpf.trim() || null,
        phone: phone.trim() || null,
      });
      setProfileSuccess('Dados pessoais atualizados com sucesso!');
    } catch (err) {
      if (err instanceof ApiError) {
        setProfileError(err.message);
      } else {
        setProfileError('Erro ao atualizar dados pessoais.');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  // Salvar Endereço
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError(null);
    setAddressSuccess(null);

    if (!recipient.trim() || !zipCode.trim() || !street.trim() || !number.trim() || !neighborhood.trim() || !city.trim() || !state.trim()) {
      setAddressError('Por favor, preencha todos os campos obrigatórios do endereço.');
      return;
    }

    try {
      setSavingAddress(true);
      await updateAddress({
        recipient: recipient.trim(),
        zip_code: zipCode.trim(),
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim() || null,
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
      });
      setAddressSuccess('Endereço de entrega salvo com sucesso!');
    } catch (err) {
      if (err instanceof ApiError) {
        setAddressError(err.message);
      } else {
        setAddressError('Erro ao salvar endereço de entrega.');
      }
    } finally {
      setSavingAddress(false);
    }
  };

  // Alterar Senha
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Informe a sua senha atual.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação da nova senha não confere.');
      return;
    }

    try {
      setSavingPassword(true);
      await changePassword({ currentPassword, newPassword });
      setPasswordSuccess('Senha alterada com sucesso! Use a nova senha no próximo login.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err instanceof ApiError) {
        setPasswordError(err.message);
      } else {
        setPasswordError('Erro ao alterar senha. Verifique a senha atual.');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const isEmployee = user.role === 'employee';

  return (
    <div style={{ width: '100%', maxWidth: '860px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Card com Resumo */}
      <div className="card" style={{ maxWidth: '100%' }}>
        <div className="account-header">
          <div>
            <h1 className="card-title" style={{ marginBottom: '0.25rem' }}>
              Minha Conta
            </h1>
            <p className="card-subtitle" style={{ marginBottom: 0 }}>
              Gerencie seus dados pessoais, endereço de entrega e segurança de acesso
            </p>
          </div>
          <span className={`badge ${isEmployee ? 'badge-employee' : 'badge-customer'}`}>
            {isEmployee ? 'Funcionário' : 'Cliente'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>E-mail cadastrado: </span>
            <strong style={{ color: 'var(--color-primary)' }}>{user.email}</strong>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {isEmployee ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('employee-orders')}>
                Painel de Pedidos
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate('my-orders')}>
                Ver Meus Pedidos
              </button>
            )}
            <button type="button" className="btn btn-danger-outline btn-sm" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? 'Saindo...' : 'Sair da conta'}
            </button>
          </div>
        </div>
      </div>

      {/* 1. Dados Pessoais (Nome, CPF e Telefone) */}
      <div className="card" style={{ maxWidth: '100%' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
          Dados Pessoais
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
          Mantenha seus dados atualizados para contato e emissão correta de pedidos
        </p>

        {profileSuccess && <div className="alert alert-success">{profileSuccess}</div>}
        {profileError && <div className="alert alert-danger">{profileError}</div>}

        <form onSubmit={handleSaveProfile} noValidate>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nome Completo</label>
              <input
                type="text"
                className="form-input"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={savingProfile}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">CPF (visível apenas para você)</label>
              <input
                type="text"
                className="form-input"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                disabled={savingProfile}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Telefone de Contato</label>
              <input
                type="tel"
                className="form-input"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={savingProfile}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={savingProfile}>
              {savingProfile ? 'Salvando...' : 'Salvar Dados Pessoais'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Endereço de Entrega (Obrigatório para clientes criarem pedidos) */}
      <div className="card" style={{ maxWidth: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-primary)' }}>
            Endereço de Entrega
          </h2>
          {user.address ? (
            <span className="badge badge-customer">Endereço Cadastrado</span>
          ) : (
            <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>Pendente</span>
          )}
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
          Este endereço será utilizado e confirmado no momento de finalizar seus pedidos
        </p>

        {addressSuccess && <div className="alert alert-success">{addressSuccess}</div>}
        {addressError && <div className="alert alert-danger">{addressError}</div>}

        <form onSubmit={handleSaveAddress} noValidate>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nome do Destinatário</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex.: Maria Souza"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                disabled={savingAddress}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">CEP</label>
              <input
                type="text"
                className="form-input"
                placeholder="00000-000"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                disabled={savingAddress}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Logradouro / Rua</label>
              <input
                type="text"
                className="form-input"
                placeholder="Rua, Avenida..."
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                disabled={savingAddress}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Número</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex.: 123"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                disabled={savingAddress}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Complemento (opcional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex.: Apto 42, Bloco C"
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                disabled={savingAddress}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Bairro</label>
              <input
                type="text"
                className="form-input"
                placeholder="Seu bairro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                disabled={savingAddress}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Cidade</label>
              <input
                type="text"
                className="form-input"
                placeholder="Sua cidade"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={savingAddress}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Estado (UF)</label>
              <input
                type="text"
                maxLength={2}
                className="form-input"
                placeholder="SP, RJ, MG..."
                value={state}
                onChange={(e) => setState(e.target.value)}
                disabled={savingAddress}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={savingAddress}>
              {savingAddress ? 'Salvando...' : 'Salvar Endereço de Entrega'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Alteração de Senha */}
      <div className="card" style={{ maxWidth: '100%' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
          Segurança e Senha
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
          Para alterar sua senha, confirme a senha atual e defina a nova credencial
        </p>

        {passwordSuccess && <div className="alert alert-success">{passwordSuccess}</div>}
        {passwordError && <div className="alert alert-danger">{passwordError}</div>}

        <form onSubmit={handleChangePassword} noValidate>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Senha Atual</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={savingPassword}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nova Senha (mínimo 6 caracteres)</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={savingPassword}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Confirmar Nova Senha</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={savingPassword}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={savingPassword}>
              {savingPassword ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
