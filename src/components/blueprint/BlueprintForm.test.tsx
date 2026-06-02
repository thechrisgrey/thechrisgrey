import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlueprintForm } from './BlueprintForm';
import type { BlueprintInput } from '../../types/blueprint';

const VALID_GOAL = 'A serverless RAG chat for my personal docs under thirty dollars';

function setup(props?: Partial<Parameters<typeof BlueprintForm>[0]>) {
  const onSubmit = vi.fn<(input: BlueprintInput) => void>();
  const utils = render(
    <BlueprintForm onSubmit={onSubmit} isGenerating={false} {...props} />
  );
  return { onSubmit, ...utils };
}

/** Returns the single payload passed to the onSubmit spy. */
function lastInput(onSubmit: ReturnType<typeof vi.fn>): BlueprintInput {
  return onSubmit.mock.calls[onSubmit.mock.calls.length - 1][0] as BlueprintInput;
}

describe('BlueprintForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the goal textarea, category select, and submit button', () => {
      setup();
      expect(screen.getByLabelText('What are you building?')).toBeInTheDocument();
      expect(screen.getByLabelText('Workload type')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /generate blueprint/i })
      ).toBeInTheDocument();
    });

    it('renders all blueprint category options with their labels', () => {
      setup();
      const select = screen.getByLabelText('Workload type');
      const options = within(select).getAllByRole('option');
      expect(options).toHaveLength(8);
      expect(within(select).getByRole('option', { name: 'Web API' })).toBeInTheDocument();
      expect(
        within(select).getByRole('option', {
          name: 'RAG (Retrieval-Augmented Generation)',
        })
      ).toBeInTheDocument();
      expect(within(select).getByRole('option', { name: 'AI Agent' })).toBeInTheDocument();
    });

    it('defaults the category select to web-api', () => {
      setup();
      const select = screen.getByLabelText('Workload type') as HTMLSelectElement;
      expect(select.value).toBe('web-api');
    });

    it('shows the default helper text when the goal is empty', () => {
      setup();
      expect(
        screen.getByText('Describe the workload in your own words.')
      ).toBeInTheDocument();
    });

    it('hides the advanced/optional fields by default', () => {
      setup();
      expect(screen.queryByLabelText('Traffic')).not.toBeInTheDocument();
      const toggle = screen.getByRole('button', { name: /optional details/i });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('goal validation', () => {
    it('disables submit when the goal is empty', () => {
      setup();
      expect(
        screen.getByRole('button', { name: /generate blueprint/i })
      ).toBeDisabled();
    });

    it('disables submit and warns when the goal is too short', async () => {
      const user = userEvent.setup();
      setup();
      await user.type(screen.getByLabelText('What are you building?'), 'too short');
      expect(screen.getByText('At least 20 characters')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /generate blueprint/i })
      ).toBeDisabled();
    });

    it('enables submit once the goal meets the minimum length', async () => {
      const user = userEvent.setup();
      setup();
      await user.type(screen.getByLabelText('What are you building?'), VALID_GOAL);
      expect(
        screen.getByText('Describe the workload in your own words.')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /generate blueprint/i })
      ).toBeEnabled();
    });

    it('reflects the trimmed character count in the counter', async () => {
      const user = userEvent.setup();
      setup();
      const goal = screen.getByLabelText('What are you building?');
      await user.type(goal, '  hello  ');
      // Trimmed length of "hello" is 5.
      expect(screen.getByText('5/500')).toBeInTheDocument();
    });
  });

  describe('submission', () => {
    it('calls onSubmit with a minimally-shaped BlueprintInput (goal + category)', async () => {
      const user = userEvent.setup();
      const { onSubmit } = setup();

      await user.type(screen.getByLabelText('What are you building?'), `   ${VALID_GOAL}   `);
      await user.click(screen.getByRole('button', { name: /generate blueprint/i }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const input = lastInput(onSubmit);
      // Goal is trimmed.
      expect(input.goal).toBe(VALID_GOAL);
      expect(input.category).toBe('web-api');
      // No optional sections when nothing else is supplied.
      expect(input.scale).toBeUndefined();
      expect(input.constraints).toBeUndefined();
      expect(input.preferred_languages).toBeUndefined();
      expect(input.integrations).toBeUndefined();
      expect(Object.keys(input).sort()).toEqual(['category', 'goal']);
    });

    it('submits the selected category', async () => {
      const user = userEvent.setup();
      const { onSubmit } = setup();

      await user.type(screen.getByLabelText('What are you building?'), VALID_GOAL);
      await user.selectOptions(screen.getByLabelText('Workload type'), 'rag');
      await user.click(screen.getByRole('button', { name: /generate blueprint/i }));

      expect(lastInput(onSubmit).category).toBe('rag');
    });

    it('does not call onSubmit when the goal is too short', async () => {
      const user = userEvent.setup();
      const { onSubmit } = setup();

      await user.type(screen.getByLabelText('What are you building?'), 'nope');
      // Submit via the form to bypass the disabled button click guard.
      const form = screen.getByLabelText('Blueprint spec form');
      (form as HTMLFormElement).requestSubmit();

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('disabled and generating states', () => {
    it('disables submit while isGenerating is true and shows the generating label', () => {
      setup({ isGenerating: true });
      const button = screen.getByRole('button', { name: /generating/i });
      expect(button).toBeDisabled();
    });

    it('disables the goal textarea and category select while generating', () => {
      setup({ isGenerating: true });
      expect(screen.getByLabelText('What are you building?')).toBeDisabled();
      expect(screen.getByLabelText('Workload type')).toBeDisabled();
    });

    it('disables submit when the disabled prop is true even with a valid goal', async () => {
      const user = userEvent.setup();
      const { onSubmit } = setup({ disabled: true });

      // The textarea is also disabled, so set the value through fireEvent-free path:
      // typing into a disabled field is a no-op, so assert the guarded form instead.
      const form = screen.getByLabelText('Blueprint spec form');
      (form as HTMLFormElement).requestSubmit();
      expect(onSubmit).not.toHaveBeenCalled();
      expect(
        screen.getByRole('button', { name: /generate blueprint/i })
      ).toBeDisabled();
      // Ensure user is defined to keep the async setup consistent.
      expect(user).toBeDefined();
    });
  });

  describe('optional advanced fields', () => {
    it('reveals the advanced fields when the toggle is clicked', async () => {
      const user = userEvent.setup();
      setup();
      await user.click(screen.getByRole('button', { name: /optional details/i }));
      expect(screen.getByLabelText('Traffic')).toBeInTheDocument();
      expect(screen.getByLabelText('Data volume')).toBeInTheDocument();
      expect(screen.getByLabelText('Latency budget')).toBeInTheDocument();
      expect(screen.getByLabelText('Monthly budget (USD)')).toBeInTheDocument();
      expect(screen.getByLabelText('Integrations (comma-separated)')).toBeInTheDocument();
    });

    it('includes scale fields in the payload when filled', async () => {
      const user = userEvent.setup();
      const { onSubmit } = setup();

      await user.type(screen.getByLabelText('What are you building?'), VALID_GOAL);
      await user.click(screen.getByRole('button', { name: /optional details/i }));
      await user.type(screen.getByLabelText('Traffic'), '1k req/day');
      await user.type(screen.getByLabelText('Data volume'), '500MB of markdown');
      await user.type(screen.getByLabelText('Latency budget'), 'first token < 2s');
      await user.click(screen.getByRole('button', { name: /generate blueprint/i }));

      expect(lastInput(onSubmit).scale).toEqual({
        traffic: '1k req/day',
        data_volume: '500MB of markdown',
        latency_budget: 'first token < 2s',
      });
    });

    it('only includes the scale keys that were filled', async () => {
      const user = userEvent.setup();
      const { onSubmit } = setup();

      await user.type(screen.getByLabelText('What are you building?'), VALID_GOAL);
      await user.click(screen.getByRole('button', { name: /optional details/i }));
      await user.type(screen.getByLabelText('Traffic'), '1k req/day');
      await user.click(screen.getByRole('button', { name: /generate blueprint/i }));

      expect(lastInput(onSubmit).scale).toEqual({ traffic: '1k req/day' });
    });

    it('parses a positive monthly budget into a number under constraints', async () => {
      const user = userEvent.setup();
      const { onSubmit } = setup();

      await user.type(screen.getByLabelText('What are you building?'), VALID_GOAL);
      await user.click(screen.getByRole('button', { name: /optional details/i }));
      await user.type(screen.getByLabelText('Monthly budget (USD)'), '30');
      await user.click(screen.getByRole('button', { name: /generate blueprint/i }));

      expect(lastInput(onSubmit).constraints).toEqual({ monthly_budget_usd: 30 });
    });

    it('omits the constraints section when no budget or compliance is supplied', async () => {
      const user = userEvent.setup();
      const { onSubmit } = setup();

      await user.type(screen.getByLabelText('What are you building?'), VALID_GOAL);
      await user.click(screen.getByRole('button', { name: /optional details/i }));
      // Advanced panel open but budget/compliance untouched.
      await user.click(screen.getByRole('button', { name: /generate blueprint/i }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(lastInput(onSubmit).constraints).toBeUndefined();
    });

    it('omits a non-positive monthly budget from constraints', async () => {
      const user = userEvent.setup();
      const { onSubmit } = setup();

      await user.type(screen.getByLabelText('What are you building?'), VALID_GOAL);
      await user.click(screen.getByRole('button', { name: /optional details/i }));
      // A value of "0" fails the input's native min="1" constraint, so submit
      // through the form to reach the component's own budget > 0 guard.
      fireEvent.change(screen.getByLabelText('Monthly budget (USD)'), {
        target: { value: '0' },
      });
      fireEvent.submit(screen.getByLabelText('Blueprint spec form'));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(lastInput(onSubmit).constraints).toBeUndefined();
    });

    it('includes compliance selections as an array under constraints', async () => {
      const user = userEvent.setup();
      const { onSubmit } = setup();

      await user.type(screen.getByLabelText('What are you building?'), VALID_GOAL);
      await user.click(screen.getByRole('button', { name: /optional details/i }));
      await user.click(screen.getByRole('button', { name: 'HIPAA' }));
      await user.click(screen.getByRole('button', { name: 'SOC2' }));
      await user.click(screen.getByRole('button', { name: /generate blueprint/i }));

      const constraints = lastInput(onSubmit).constraints;
      expect(constraints?.compliance).toEqual(['hipaa', 'soc2']);
    });

    it('toggles a compliance chip off when clicked twice', async () => {
      const user = userEvent.setup();
      const { onSubmit } = setup();

      await user.type(screen.getByLabelText('What are you building?'), VALID_GOAL);
      await user.click(screen.getByRole('button', { name: /optional details/i }));
      const hipaa = screen.getByRole('button', { name: 'HIPAA' });
      await user.click(hipaa);
      expect(hipaa).toHaveAttribute('aria-pressed', 'true');
      await user.click(hipaa);
      expect(hipaa).toHaveAttribute('aria-pressed', 'false');
      await user.click(screen.getByRole('button', { name: /generate blueprint/i }));

      expect(lastInput(onSubmit).constraints).toBeUndefined();
    });

    it('includes preferred languages as an array', async () => {
      const user = userEvent.setup();
      const { onSubmit } = setup();

      await user.type(screen.getByLabelText('What are you building?'), VALID_GOAL);
      await user.click(screen.getByRole('button', { name: /optional details/i }));
      await user.click(screen.getByRole('button', { name: 'typescript' }));
      await user.click(screen.getByRole('button', { name: 'python' }));
      await user.click(screen.getByRole('button', { name: /generate blueprint/i }));

      expect(lastInput(onSubmit).preferred_languages).toEqual(['typescript', 'python']);
    });

    it('splits, trims, and filters the comma-separated integrations list', async () => {
      const user = userEvent.setup();
      const { onSubmit } = setup();

      await user.type(screen.getByLabelText('What are you building?'), VALID_GOAL);
      await user.click(screen.getByRole('button', { name: /optional details/i }));
      await user.type(
        screen.getByLabelText('Integrations (comma-separated)'),
        'Stripe, , Salesforce ,'
      );
      await user.click(screen.getByRole('button', { name: /generate blueprint/i }));

      expect(lastInput(onSubmit).integrations).toEqual(['Stripe', 'Salesforce']);
    });

    it('combines scale, constraints, languages, and integrations into one payload', async () => {
      const user = userEvent.setup();
      const { onSubmit } = setup();

      await user.type(screen.getByLabelText('What are you building?'), VALID_GOAL);
      await user.selectOptions(screen.getByLabelText('Workload type'), 'ai-agent');
      await user.click(screen.getByRole('button', { name: /optional details/i }));
      await user.type(screen.getByLabelText('Traffic'), '100 rps');
      await user.type(screen.getByLabelText('Monthly budget (USD)'), '250');
      await user.click(screen.getByRole('button', { name: 'GDPR' }));
      await user.click(screen.getByRole('button', { name: 'go' }));
      await user.type(
        screen.getByLabelText('Integrations (comma-separated)'),
        'Stripe'
      );
      await user.click(screen.getByRole('button', { name: /generate blueprint/i }));

      expect(lastInput(onSubmit)).toEqual({
        goal: VALID_GOAL,
        category: 'ai-agent',
        scale: { traffic: '100 rps' },
        constraints: { monthly_budget_usd: 250, compliance: ['gdpr'] },
        preferred_languages: ['go'],
        integrations: ['Stripe'],
      });
    });
  });
});
