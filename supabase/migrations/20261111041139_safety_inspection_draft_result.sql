alter table public.material_safety_inspections
  drop constraint material_safety_inspections_completed_result_required,
  add constraint material_safety_inspections_completed_result_required
    check (
      (
        status = 'in_progress'
        and (overall_result is null or overall_result in ('passed', 'failed'))
      )
      or (
        status = 'completed'
        and overall_result is not null
        and overall_result in ('passed', 'failed')
      )
    );

notify pgrst, 'reload schema';
