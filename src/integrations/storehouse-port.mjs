import { AppError } from '../application/errors.mjs';

/** Provider boundary, NOT an implementation of an assumed StoreHouse endpoint.
 * Submit and verify receive stable application operation IDs plus verified
 * external product/location IDs. Printed PDF sourceCode is provenance only.
 * authoritative absence means the prior request is conclusively finished and
 * cannot commit later; an empty eventually-consistent query is NOT sufficient.
 * A provider must establish an authoritative lookup before retrying an uncertain
 * write. r_keeper/QUSH consumption is read from the inventory authority and must
 * never be translated into a second stock deduction.
 *
 * submit(child): {status:'accepted'|'rejected', externalId?:string, reason?:string}
 * verify(child): {status:'confirmed'|'rejected'|'unknown'|'absent',
 *   externalId?:string, authoritative?:boolean, reason?:string}
 */
export class UnconfiguredStoreHouseAdapter {
  configured=false;
  mode='live';
  async submit(){throw new AppError(503,'NOT_CONFIGURED','A StoreHouse írási kapcsolat és a visszaellenőrzés még nincs igazolva.');}
  async verify(){throw new AppError(503,'NOT_CONFIGURED','A StoreHouse visszaellenőrző kapcsolat még nincs beállítva.');}
  async readInventory(){throw new AppError(503,'NOT_CONFIGURED','Nincs ellenőrzött StoreHouse készletlekérdezés.');}
}
