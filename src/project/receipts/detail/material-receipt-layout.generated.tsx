/**
 * Scaffolded by detail-builder from `src/project/receipts/detail/material-receipt.detail.fixture.ts`. Run `npm run gen:detail` — do NOT hand-write this file.
 * You own this file now — wire profile, information, actions, and tab content to screen logic.
 * To change the tab structure, edit the spec and re-gen to a scratch path first.
 */
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper';
import { EntityDetailLayout } from '@/components/layouts/entity-detail-layout';

export interface MaterialReceiptDetailLayoutProps {
  profile: ReactNode;
  information: ReactNode;
  itemsContent: ReactNode;
  allocationContent: ReactNode;
  className?: string;
}
export function MaterialReceiptDetailLayout({
  profile,
  information,
  itemsContent,
  allocationContent,
  className,
}: MaterialReceiptDetailLayoutProps) {
  const intl = useIntl();
  const [activeStep, setActiveStep] = useState(1);

  return (
    <EntityDetailLayout
      profile={profile}
      information={information}
      tabs={
        <Stepper value={activeStep} onValueChange={setActiveStep}>
          <StepperNav className="rounded-lg border border-border bg-card px-5 py-4">
            <StepperItem step={1}>
              <StepperTrigger className="rounded-md px-2 py-1.5 text-left data-[state=active]:text-primary">
                <StepperIndicator>1</StepperIndicator>
                <StepperTitle>
                  {intl.formatMessage({ id: 'receipts.tabs.items' })}
                </StepperTitle>
              </StepperTrigger>
              <StepperSeparator />
            </StepperItem>
            <StepperItem step={2}>
              <StepperTrigger className="rounded-md px-2 py-1.5 text-left data-[state=active]:text-primary">
                <StepperIndicator>2</StepperIndicator>
                <StepperTitle>
                  {intl.formatMessage({ id: 'receipts.tabs.allocation' })}
                </StepperTitle>
              </StepperTrigger>
            </StepperItem>
          </StepperNav>
          <StepperPanel className="mt-admin-page-section">
            <StepperContent value={1}>{itemsContent}</StepperContent>
            <StepperContent value={2}>{allocationContent}</StepperContent>
          </StepperPanel>
        </Stepper>
      }
      className={className}
    />
  );
}
