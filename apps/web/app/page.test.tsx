import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from './page';

describe('HomePage', () => {
  it('renders the product name, positioning and waitlist form', () => {
    render(<HomePage />);

    expect(screen.getByText('NextFood')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Gestão inteligente/i })).toBeInTheDocument();
    expect(screen.getByText(/lista de espera/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
  });
});
