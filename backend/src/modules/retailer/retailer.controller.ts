import type { Request, Response } from 'express';
import * as retailerService from './retailer.service.js';
import { ok, okList } from '../../utils/response.js';
import { SUCCESS_CODES } from '../../constants/success-codes.js';

export async function getMine(req: Request, res: Response) {
  const result = await retailerService.getMine(req.user!.userId);

  return ok(res, {
    code: SUCCESS_CODES.RETAILER_PROFILE_FETCHED,
    message: result.profile ? 'Retailer profile fetched successfully' : 'Retailer profile not yet submitted',
    data: result,
  });
}

export async function upsertMine(req: Request, res: Response) {
  const result = await retailerService.upsertMine(req.user!.userId, req.valid.body);

  return ok(res, {
    code: SUCCESS_CODES.RETAILER_PROFILE_SUBMITTED,
    message: 'Retailer profile submitted for verification successfully',
    data: result,
  });
}

export async function listRetailers(req: Request, res: Response) {
  const { rows, totalItems } = await retailerService.listRetailers(req.valid.query);

  return okList(res, {
    code: SUCCESS_CODES.RETAILERS_LISTED,
    message: 'Retailers listed successfully',
    data: rows,
    page: req.valid.query.page || 1,
    pageSize: req.valid.query.pageSize || 20,
    totalItems,
  });
}

export async function getRetailerById(req: Request, res: Response) {
  const retailer = await retailerService.getRetailerById(req.valid.params.userId);

  return ok(res, {
    code: SUCCESS_CODES.RETAILER_PROFILE_FETCHED,
    message: 'Retailer details retrieved successfully',
    data: retailer,
  });
}

export async function approveRetailer(req: Request, res: Response) {
  const result = await retailerService.reviewRetailer(
    req.user!.userId,
    req.valid.params.userId,
    'APPROVE'
  );

  return ok(res, {
    code: SUCCESS_CODES.RETAILER_APPROVED,
    message: 'Retailer profile approved successfully',
    data: result,
  });
}

export async function rejectRetailer(req: Request, res: Response) {
  const result = await retailerService.reviewRetailer(
    req.user!.userId,
    req.valid.params.userId,
    'REJECT',
    req.valid.body.reason
  );

  return ok(res, {
    code: SUCCESS_CODES.RETAILER_REJECTED,
    message: 'Retailer profile rejected',
    data: result,
  });
}
