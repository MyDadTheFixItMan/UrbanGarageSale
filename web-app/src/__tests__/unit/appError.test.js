import { AppError, toAppError } from '@/lib/appError';

describe('toAppError', () => {
  test('maps known Firebase codes to friendly text and keeps the code', () => {
    const original = Object.assign(new Error('Firebase: Error (auth/wrong-password).'), { code: 'auth/wrong-password' });
    const error = toAppError(original, 'Login failed');
    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe('Incorrect email or password.');
    expect(error.code).toBe('auth/wrong-password');
    expect(error.cause).toBe(original);
  });

  test('uses the fallback for unknown codes rather than the raw Firebase message', () => {
    const error = toAppError(Object.assign(new Error('Firebase: internal thing'), { code: 'auth/internal-error' }), 'Login failed');
    expect(error.message).toBe('Login failed');
  });

  test('keeps messages written by callable functions, except internal errors', () => {
    expect(toAppError({ code: 'functions/failed-precondition', message: 'Only listings awaiting approval can be rejected' }).message)
      .toBe('Only listings awaiting approval can be rejected');
    expect(toAppError({ code: 'functions/internal', message: 'INTERNAL' }, 'Failed').message).toBe('Failed');
  });

  test('passes AppErrors through unchanged', () => {
    const error = new AppError('Already friendly', { code: 'x' });
    expect(toAppError(error)).toBe(error);
  });
});
