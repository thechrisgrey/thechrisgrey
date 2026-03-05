import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormInput } from './FormInput';

describe('FormInput', () => {
  const defaultProps = {
    id: 'test-input',
    label: 'Email',
    value: '',
    onChange: vi.fn(),
  };

  it('should render with a visible label', () => {
    render(<FormInput {...defaultProps} />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('should render with a hidden label when hideLabel is true', () => {
    render(<FormInput {...defaultProps} hideLabel />);
    const label = screen.getByText('Email');
    expect(label).toHaveClass('sr-only');
  });

  it('should display the current value', () => {
    render(<FormInput {...defaultProps} value="test@example.com" />);
    expect(screen.getByLabelText('Email')).toHaveValue('test@example.com');
  });

  it('should call onChange with the new value when typing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FormInput {...defaultProps} onChange={onChange} />);

    await user.type(screen.getByLabelText('Email'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('should apply placeholder text', () => {
    render(<FormInput {...defaultProps} placeholder="Enter email" />);
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
  });

  it('should set the input type', () => {
    render(<FormInput {...defaultProps} type="email" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
  });

  it('should default to type text', () => {
    render(<FormInput {...defaultProps} />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'text');
  });

  it('should show required indicator when required', () => {
    render(<FormInput {...defaultProps} required />);
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('required');
  });

  it('should display error message when error is provided', () => {
    render(<FormInput {...defaultProps} error="This field is required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('This field is required');
  });

  it('should set aria-invalid when error exists', () => {
    render(<FormInput {...defaultProps} error="Error message" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('should set aria-describedby pointing to error element', () => {
    render(<FormInput {...defaultProps} error="Error" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-describedby', 'test-input-error');
  });

  it('should not set aria-describedby when no error', () => {
    render(<FormInput {...defaultProps} />);
    const input = screen.getByLabelText('Email');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('should apply custom className', () => {
    const { container } = render(<FormInput {...defaultProps} className="mt-4" />);
    expect(container.firstChild).toHaveClass('mt-4');
  });
});
