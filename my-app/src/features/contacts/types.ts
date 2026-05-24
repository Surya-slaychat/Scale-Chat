/**
 * Contacts feature types — directly re-exports the shared schema types so the
 * mobile UI and the API stay in lockstep. (CLAUDE.md §3 — frontend types mirror
 * the eventual `packages/shared` contract.)
 */
export type {
  Contact,
  ContactPublic,
  AddContactBody,
  UpdateContactBody,
  ContactsListResponse,
} from '@scalechat/shared';
