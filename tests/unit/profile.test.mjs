import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanProfile, displayFor, toDate, LIMITS } from '../../js/firebase/profile.js';

test('cleanProfile trims, caps lengths and needs a name', () => {
  const { profile, error } = cleanProfile({ name: '  Ada \n Lovelace ', title: 'x'.repeat(99), bio: 'hi\n\n\n\nthere', avatar: 'emoji:🦊' });
  assert.equal(error, '');
  assert.equal(profile.name, 'Ada Lovelace');
  assert.equal(profile.title.length, LIMITS.title);
  assert.equal(profile.bio, 'hi\n\nthere');
  assert.equal(profile.avatar, 'emoji:🦊');
  assert.equal(cleanProfile({ name: '  ' }).error, 'Please enter a name.');
});

test('cleanProfile only keeps known avatars and small image data URLs', () => {
  assert.equal(cleanProfile({ name: 'a', avatar: 'emoji:💩' }).profile.avatar, 'google');
  assert.equal(cleanProfile({ name: 'a', avatar: 'upload', photo: 'data:image/jpeg;base64,AAAA' }).profile.avatar, 'upload');
  assert.match(cleanProfile({ name: 'a', avatar: 'upload', photo: 'javascript:alert(1)' }).error, /picture/);
  assert.match(cleanProfile({ name: 'a', avatar: 'upload', photo: 'data:image/jpeg;base64,' + 'A'.repeat(LIMITS.photo) }).error, /picture/);
  assert.equal(cleanProfile({ name: 'a', avatar: 'google', photo: 'data:image/jpeg;base64,AAAA' }).profile.photo, '');
});

test('displayFor prefers the profile, else the Google account', () => {
  const user = { name: 'G Name', email: 'g@x.com', photoURL: 'https://g/photo' };
  assert.deepEqual(displayFor(user, null), { name: 'G Name', photo: 'https://g/photo', emoji: '', initial: 'G' });
  assert.equal(displayFor(user, { name: 'Ada', avatar: 'emoji:🦊' }).emoji, '🦊');
  assert.equal(displayFor(user, { name: 'Ada', avatar: 'emoji:🦊' }).photo, '');
  assert.equal(displayFor(user, { name: 'Ada', avatar: 'upload', photo: 'data:x' }).photo, 'data:x');
  assert.equal(displayFor(null, null), null);
});

test('toDate reads Firestore timestamps', () => {
  assert.equal(toDate({ seconds: 0 }).getTime(), 0);
  assert.equal(toDate({ toDate: () => new Date(5) }).getTime(), 5);
  assert.equal(toDate({ __ts: 'server' }), null);
});
