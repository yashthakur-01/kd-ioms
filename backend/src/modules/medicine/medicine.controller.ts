import type { Request, Response } from 'express';
import * as medicineService from './medicine.service.js';
import { ok, created, okList } from '../../utils/response.js';
import { SUCCESS_CODES } from '../../constants/success-codes.js';

export async function createMedicine(req: Request, res: Response) {
  const body = (req as unknown as { valid: { body: medicineService.CreateMedicineInput } }).valid.body;
  const actor = {
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
  };

  const medicine = await medicineService.createMedicine(body, actor);

  return created(res, {
    code: SUCCESS_CODES.MEDICINE_CREATED,
    message: 'Medicine created successfully',
    data: medicine,
  });
}

export async function listMedicines(req: Request, res: Response) {
  const query = (req as unknown as { valid: { query: medicineService.ListMedicinesQuery } }).valid.query;
  const { rows, totalItems } = await medicineService.listMedicines(query);

  return okList(res, {
    code: SUCCESS_CODES.MEDICINES_LISTED,
    message: 'Medicines listed successfully',
    data: rows,
    page: query.page || 1,
    pageSize: query.pageSize || 20,
    totalItems,
  });
}

export async function searchMedicines(req: Request, res: Response) {
  const { q } = (req as unknown as { valid: { query: { q: string } } }).valid.query;
  const matches = await medicineService.searchMedicines(q);

  return ok(res, {
    code: SUCCESS_CODES.MEDICINES_SEARCHED,
    message: 'Medicines searched successfully',
    data: matches,
  });
}

export async function getMedicineById(req: Request, res: Response) {
  const { medicineId } = (req as unknown as { valid: { params: { medicineId: number } } }).valid.params;
  const medicine = await medicineService.getMedicineById(medicineId);

  return ok(res, {
    code: SUCCESS_CODES.MEDICINE_FETCHED,
    message: 'Medicine fetched successfully',
    data: medicine,
  });
}

export async function updateMedicine(req: Request, res: Response) {
  const { medicineId } = (req as unknown as { valid: { params: { medicineId: number } } }).valid.params;
  const body = (req as unknown as { valid: { body: medicineService.UpdateMedicineInput } }).valid.body;
  const actor = {
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
  };

  const medicine = await medicineService.updateMedicine(medicineId, body, actor);

  return ok(res, {
    code: SUCCESS_CODES.MEDICINE_UPDATED,
    message: 'Medicine updated successfully',
    data: medicine,
  });
}
