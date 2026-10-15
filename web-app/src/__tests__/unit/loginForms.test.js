import {
  normalizePhone, signUpProblem, postcodeAndState, oauthErrorMessage, profileFromOAuthUser,
} from '@/pages/login/loginForms';

describe('normalizePhone', () => {
  it('turns an Australian mobile into E.164', () => {
    expect(normalizePhone('+61 412 345 678')).toEqual({ phone: '+61412345678' });
    expect(normalizePhone('+61 (412) 345-678')).toEqual({ phone: '+61412345678' });
  });

  it('drops the leading 0 people type after +61', () => {
    expect(normalizePhone('+61 0412 345 678')).toEqual({ phone: '+61412345678' });
  });

  it('refuses an incomplete number or just the country code', () => {
    expect(normalizePhone('+61 ').problem).toMatch(/complete phone number/);
    expect(normalizePhone('+61 412').problem).toMatch(/complete phone number/);
  });

  it('refuses a number without a country code', () => {
    expect(normalizePhone('0412 345 678').problem).toMatch(/with country code/);
  });
});

describe('signUpProblem', () => {
  const valid = {
    fullName: 'Sam Lee', address: '1 Main St, Carlton VIC 3053', email: 'sam@example.com',
    phone: '+61 412 345 678', password: 'garage-sale-2026', confirmPassword: 'garage-sale-2026',
  };

  it('accepts a complete form', () => {
    expect(signUpProblem(valid)).toBeNull();
  });

  it('reports the first problem in order', () => {
    expect(signUpProblem({ ...valid, fullName: '' })).toBe('Please fill in all fields');
    expect(signUpProblem({ ...valid, confirmPassword: 'other-password-1' })).toBe('Passwords do not match');
    expect(signUpProblem({ ...valid, password: 'short1', confirmPassword: 'short1' })).toMatch(/at least 12 characters/);
    expect(signUpProblem({ ...valid, phone: '+61 412' })).toMatch(/complete phone number/);
  });
});

describe('postcodeAndState', () => {
  it('keeps the postcode and state from the chosen address', () => {
    expect(postcodeAndState('anything', '3053', 'VIC')).toEqual({ postcode: '3053', state: 'VIC' });
  });

  it('reads two- and three-letter states from a typed address', () => {
    expect(postcodeAndState('1 Main St, Carlton VIC 3053', '', '')).toEqual({ postcode: '3053', state: 'VIC' });
    expect(postcodeAndState('2 King St, Perth WA 6000', '', '')).toEqual({ postcode: '6000', state: 'WA' });
  });

  it('leaves them empty when the address has neither', () => {
    expect(postcodeAndState('1 Main St', '', '')).toEqual({ postcode: '', state: '' });
  });
});

describe('oauthErrorMessage', () => {
  it('explains a closed or blocked popup', () => {
    expect(oauthErrorMessage(new Error('auth/popup-closed-by-user'), 'Sign in', 'google')).toBe('Sign in was cancelled');
    expect(oauthErrorMessage(new Error('auth/popup-blocked'), 'Sign up', 'apple')).toMatch(/^Sign up popup was blocked/);
  });

  it('falls back to the error message, or a generic one', () => {
    expect(oauthErrorMessage(new Error('Account disabled'), 'Sign in', 'google')).toBe('Account disabled');
    expect(oauthErrorMessage({}, 'Sign up', 'facebook')).toBe('Failed to sign up with facebook');
  });
});

describe('profileFromOAuthUser', () => {
  const NOW = new Date('2026-10-15T00:00:00Z');

  it('uses the display name, or the start of the email address', () => {
    expect(profileFromOAuthUser({ email: 'sam@example.com', displayName: 'Sam Lee' }, NOW).full_name).toBe('Sam Lee');
    expect(profileFromOAuthUser({ email: 'sam@example.com' }, NOW)).toEqual({
      email: 'sam@example.com', full_name: 'sam', phone_verified: false, created_date: '2026-10-15T00:00:00.000Z', role: 'user',
    });
  });
});
