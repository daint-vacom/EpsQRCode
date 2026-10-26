import { z } from 'zod';

export const representativeAssignmentFormSchema = z.object({
  userIds: z.array(z.string()),
});

export type RepresentativeAssignmentFormValues = z.infer<
  typeof representativeAssignmentFormSchema
>;

export interface RepresentativeAssignment {
  userIds: string[];
}
