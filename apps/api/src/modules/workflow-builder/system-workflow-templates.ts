import type { SystemWorkflowTemplate } from "./workflow-builder.types";

export const SYSTEM_WORKFLOW_TEMPLATES: SystemWorkflowTemplate[] = [
  {
    name: "Lead Follow-Up",
    description: "Reconnect with new leads who have not booked an appointment.",
    category: "LEAD",
    triggerType: "NEW_LEAD",
    estimatedConversionImpact: 4,
    configuration: {
      triggerType: "NEW_LEAD",
      delayMinutes: 1440,
      timing: "AFTER_TRIGGER",
      actionType: "SMS",
      conditions: { noAppointmentBooked: true, leadStatuses: ["NEW", "CONTACTED"] },
      messageTemplate:
        "Hi {{firstName}}, thanks for your interest. Would you like help booking an appointment?",
    },
  },
  {
    name: "Appointment Reminder",
    description: "Reduce no-shows with a reminder one day before an upcoming appointment.",
    category: "APPOINTMENT",
    triggerType: "UPCOMING_APPOINTMENT",
    estimatedConversionImpact: 5,
    configuration: {
      triggerType: "UPCOMING_APPOINTMENT",
      delayMinutes: 1440,
      timing: "BEFORE_EVENT",
      actionType: "SMS",
      conditions: { appointmentStatuses: ["PENDING", "CONFIRMED"] },
      messageTemplate:
        "Hi {{firstName}}, this is a reminder about your upcoming appointment. Reply here if you need help.",
    },
  },
  {
    name: "Review Request",
    description: "Ask satisfied customers for feedback after a completed appointment.",
    category: "REVIEW",
    triggerType: "APPOINTMENT_COMPLETED",
    estimatedConversionImpact: 3,
    configuration: {
      triggerType: "APPOINTMENT_COMPLETED",
      delayMinutes: 4320,
      timing: "AFTER_TRIGGER",
      actionType: "SMS",
      conditions: { appointmentStatuses: ["COMPLETED"] },
      messageTemplate:
        "Hi {{firstName}}, thank you for choosing us. We'd appreciate hearing how your appointment went.",
    },
  },
  {
    name: "Quote Follow-Up",
    description: "Follow up after a quote is sent while the opportunity is still warm.",
    category: "QUOTE",
    triggerType: "QUOTE_SENT",
    estimatedConversionImpact: 4,
    configuration: {
      triggerType: "QUOTE_SENT",
      delayMinutes: 7200,
      timing: "AFTER_TRIGGER",
      actionType: "SMS",
      conditions: { customerStatuses: ["NEW", "CONTACTED", "QUALIFIED"] },
      messageTemplate:
        "Hi {{firstName}}, I'm following up on the quote we sent. Is there anything you'd like clarified?",
    },
  },
];
