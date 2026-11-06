import React from 'react';
import { OrderStatus } from '../types';

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status }) => {
  let badgeClass = 'badge-status-recebido';
  if (status === 'em preparação') {
    badgeClass = 'badge-status-em-preparacao';
  } else if (status === 'enviado') {
    badgeClass = 'badge-status-enviado';
  } else if (status === 'cancelado') {
    badgeClass = 'badge-status-cancelado';
  }

  return <span className={`badge ${badgeClass}`}>{status}</span>;
};
