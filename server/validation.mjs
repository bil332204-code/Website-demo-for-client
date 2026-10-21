import { z } from 'zod';
import { services } from '../src/data.js';
export const categories = [...services.map(s => s.title), 'SolidWorks mentorship', 'Ansys mentorship', 'Academic project guidance', 'Product inquiry', 'Other / not sure yet'];
const text = (min, max) => z.string().trim().min(min).max(max).refine(v => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v), 'Contains unsupported characters');
export const inquirySchema = z.object({
 name: text(2, 100), email: z.string().trim().email().max(200).transform(v => v.toLowerCase()),
 phone: text(0, 40).optional().default(''), category: z.enum(categories),
 message: text(10, 5000), notes: text(0, 1000).optional().default(''),
 consent: z.literal(true), website: z.string().max(200).optional().default(''),
});
export const statusSchema = z.object({ status: z.enum(['new', 'in_progress', 'closed']) });
export const querySchema = z.object({
 page: z.coerce.number().int().min(1).max(100000).default(1),
 limit: z.coerce.number().int().min(1).max(100).default(20),
 status: z.enum(['new', 'in_progress', 'closed']).optional(), search: z.string().trim().max(200).default(''),
});
