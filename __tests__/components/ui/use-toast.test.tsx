import { renderHook, act } from '@testing-library/react';
import { useToast, toast, reducer } from '@/components/ui/use-toast';

describe('useToast Hook', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('toast function', () => {
    it('creates a toast with default properties', () => {
      const result = toast({ title: 'Test Toast' });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('dismiss');
      expect(result).toHaveProperty('update');
    });

    it('creates a success toast using convenience method', () => {
      const result = toast.success('Success!', 'Operation completed');

      expect(result).toHaveProperty('id');
    });

    it('creates an error toast using convenience method', () => {
      const result = toast.error('Error!', 'Something went wrong');

      expect(result).toHaveProperty('id');
    });

    it('creates a warning toast using convenience method', () => {
      const result = toast.warning('Warning!', 'Be careful');

      expect(result).toHaveProperty('id');
    });

    it('creates an info toast using convenience method', () => {
      const result = toast.info('Info', 'Just letting you know');

      expect(result).toHaveProperty('id');
    });
  });

  describe('useToast hook', () => {
    it('returns toast function and dismiss function', () => {
      const { result } = renderHook(() => useToast());

      expect(result.current.toast).toBeDefined();
      expect(result.current.dismiss).toBeDefined();
      expect(result.current.toasts).toBeDefined();
    });
  });

  describe('reducer', () => {
    it('adds a toast', () => {
      const initialState = { toasts: [] };
      const newToast = {
        id: '1',
        title: 'Test',
        open: true,
      };

      const newState = reducer(initialState, {
        type: 'ADD_TOAST',
        toast: newToast,
      });

      expect(newState.toasts).toHaveLength(1);
      expect(newState.toasts[0].title).toBe('Test');
    });

    it('updates a toast', () => {
      const initialState = {
        toasts: [{ id: '1', title: 'Original', open: true }],
      };

      const newState = reducer(initialState, {
        type: 'UPDATE_TOAST',
        toast: { id: '1', title: 'Updated' },
      });

      expect(newState.toasts[0].title).toBe('Updated');
    });

    it('dismisses a specific toast', () => {
      const initialState = {
        toasts: [
          { id: '1', title: 'Toast 1', open: true },
          { id: '2', title: 'Toast 2', open: true },
        ],
      };

      const newState = reducer(initialState, {
        type: 'DISMISS_TOAST',
        toastId: '1',
      });

      expect(newState.toasts[0].open).toBe(false);
      expect(newState.toasts[1].open).toBe(true);
    });

    it('dismisses all toasts when no id provided', () => {
      const initialState = {
        toasts: [
          { id: '1', title: 'Toast 1', open: true },
          { id: '2', title: 'Toast 2', open: true },
        ],
      };

      const newState = reducer(initialState, {
        type: 'DISMISS_TOAST',
      });

      expect(newState.toasts[0].open).toBe(false);
      expect(newState.toasts[1].open).toBe(false);
    });

    it('removes a specific toast', () => {
      const initialState = {
        toasts: [
          { id: '1', title: 'Toast 1', open: true },
          { id: '2', title: 'Toast 2', open: true },
        ],
      };

      const newState = reducer(initialState, {
        type: 'REMOVE_TOAST',
        toastId: '1',
      });

      expect(newState.toasts).toHaveLength(1);
      expect(newState.toasts[0].id).toBe('2');
    });

    it('removes all toasts when no id provided', () => {
      const initialState = {
        toasts: [
          { id: '1', title: 'Toast 1', open: true },
          { id: '2', title: 'Toast 2', open: true },
        ],
      };

      const newState = reducer(initialState, {
        type: 'REMOVE_TOAST',
      });

      expect(newState.toasts).toHaveLength(0);
    });

    it('limits toasts to 5', () => {
      let state = { toasts: [] };

      for (let i = 0; i < 7; i++) {
        state = reducer(state, {
          type: 'ADD_TOAST',
          toast: { id: String(i), title: `Toast ${i}`, open: true },
        });
      }

      expect(state.toasts).toHaveLength(5);
    });
  });
});
