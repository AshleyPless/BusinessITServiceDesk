
import { useCallback, useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5150/api/tickets";

const STATUSES = ["Open", "In Progress", "Resolved"] as const;
const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

const TECHNICIANS = [
  "Unassigned",
  "IT Support Technician",
  "Systems Administrator",
  "Application Support",
  "Network Technician",
] as const;

type TicketStatus = (typeof STATUSES)[number];
type TicketPriority = (typeof PRIORITIES)[number];

type Ticket = {
  id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
  troubleshootingNotes: string;
  assignedTo: string;
  resolutionDueAt: string | null;
  resolvedAt: string | null;
};

type TicketActivity = {
  id: number;
  ticketId: number;
  action: string;
  details: string;
  createdAt: string;
};

type TicketForm = {
  title: string;
  description: string;
  priority: TicketPriority;
};

type SlaInfo = {
  label: string;
  detail: string;
  className: string;
  overdue: boolean;
};

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.message ?? `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.floor(Math.abs(milliseconds) / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function getSlaInfo(ticket: Ticket, now: number): SlaInfo {
  if (ticket.status === "Resolved" || ticket.status === "Closed") {
    return {
      label: "Resolved",
      detail: ticket.resolvedAt
        ? `Resolved ${formatDate(ticket.resolvedAt)}`
        : "Ticket is no longer active",
      className: "sla-resolved",
      overdue: false,
    };
  }

  if (!ticket.resolutionDueAt) {
    return {
      label: "No deadline",
      detail: "No resolution deadline has been set",
      className: "sla-no-deadline",
      overdue: false,
    };
  }

  const dueAt = new Date(ticket.resolutionDueAt).getTime();

  if (Number.isNaN(dueAt)) {
    return {
      label: "Invalid deadline",
      detail: "Check the resolution deadline",
      className: "sla-no-deadline",
      overdue: false,
    };
  }

  const difference = dueAt - now;

  if (difference < 0) {
    return {
      label: "Overdue",
      detail: `${formatDuration(difference)} overdue`,
      className: "sla-overdue",
      overdue: true,
    };
  }

  if (difference <= 24 * 60 * 60 * 1000) {
    return {
      label: "Due soon",
      detail: `${formatDuration(difference)} remaining`,
      className: "sla-due-soon",
      overdue: false,
    };
  }

  return {
    label: "On track",
    detail: `${formatDuration(difference)} remaining`,
    className: "sla-on-track",
    overdue: false,
  };
}

function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");

  const [form, setForm] = useState<TicketForm>({
    title: "",
    description: "",
    priority: "Medium",
  });
  const [isCreating, setIsCreating] = useState(false);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState("Unassigned");
  const [notesDraft, setNotesDraft] = useState("");
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const [activities, setActivities] = useState<TicketActivity[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [activityError, setActivityError] = useState("");

  const loadTickets = useCallback(async () => {
    try {
      setError("");

      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data: Ticket[] = await response.json();
      setTickets(data);

      setSelectedTicket((current) => {
        if (!current) return null;
        return data.find((ticket) => ticket.id === current.id) ?? null;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load tickets. Check that the API is running.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadActivity = useCallback(async (ticketId: number) => {
    setIsLoadingActivity(true);
    setActivityError("");

    try {
      const response = await fetch(`${API_URL}/${ticketId}/activity`);

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data: TicketActivity[] = await response.json();
      setActivities(data);
    } catch (err) {
      setActivities([]);
      setActivityError(
        err instanceof Error
          ? err.message
          : "Unable to load ticket activity.",
      );
    } finally {
      setIsLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      setAssignmentDraft(selectedTicket.assignedTo || "Unassigned");
      setNotesDraft(selectedTicket.troubleshootingNotes || "");
      setActivities([]);
      void loadActivity(selectedTicket.id);
    } else {
      setActivities([]);
      setActivityError("");
    }
  }, [selectedTicket?.id, loadActivity]);

  const refreshTicketAndActivity = async (ticketId: number) => {
    await loadTickets();
    await loadActivity(ticketId);
  };

  const handleCreateTicket = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!form.title.trim() || !form.description.trim()) {
      setError("Enter a ticket title and description.");
      return;
    }

    setIsCreating(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          priority: form.priority,
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setForm({
        title: "",
        description: "",
        priority: "Medium",
      });

      setSearchTerm("");
      setStatusFilter("All");
      setPriorityFilter("All");
      setAssigneeFilter("All");

      setSuccessMessage("Ticket created successfully with an SLA deadline.");
      await loadTickets();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create ticket.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const updateStatus = async (ticket: Ticket, status: TicketStatus) => {
    if (ticket.status === status) return;

    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${API_URL}/${ticket.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setSuccessMessage(`Ticket #${ticket.id} status updated.`);
      await refreshTicketAndActivity(ticket.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update ticket status.",
      );
    }
  };

  const openTicketDetails = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setAssignmentDraft(ticket.assignedTo || "Unassigned");
    setNotesDraft(ticket.troubleshootingNotes || "");
    setError("");
    setSuccessMessage("");
  };

  const closeTicketDetails = () => {
    setSelectedTicket(null);
  };

  const saveAssignment = async () => {
    if (!selectedTicket) return;

    setIsSavingAssignment(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `${API_URL}/${selectedTicket.id}/assignment`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignedTo: assignmentDraft }),
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setSuccessMessage("Ticket assignment saved.");
      await refreshTicketAndActivity(selectedTicket.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save assignment.",
      );
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const saveTroubleshootingNotes = async () => {
    if (!selectedTicket) return;

    setIsSavingNotes(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${API_URL}/${selectedTicket.id}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setSuccessMessage("Troubleshooting notes saved.");
      await refreshTicketAndActivity(selectedTicket.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save troubleshooting notes.",
      );
    } finally {
      setIsSavingNotes(false);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    const search = searchTerm.trim().toLowerCase();

    const matchesSearch =
      !search ||
      ticket.title.toLowerCase().includes(search) ||
      ticket.description.toLowerCase().includes(search) ||
      String(ticket.id).includes(search);

    const matchesStatus =
      statusFilter === "All" || ticket.status === statusFilter;

    const matchesPriority =
      priorityFilter === "All" || ticket.priority === priorityFilter;

    const matchesAssignee =
      assigneeFilter === "All" ||
      (ticket.assignedTo || "Unassigned") === assigneeFilter;

    return (
      matchesSearch && matchesStatus && matchesPriority && matchesAssignee
    );
  });

  const openCount = tickets.filter((ticket) => ticket.status === "Open").length;

  const inProgressCount = tickets.filter(
    (ticket) => ticket.status === "In Progress",
  ).length;

  const resolvedCount = tickets.filter(
    (ticket) =>
      ticket.status === "Resolved" || ticket.status === "Closed",
  ).length;

  const unassignedCount = tickets.filter(
    (ticket) =>
      !ticket.assignedTo || ticket.assignedTo === "Unassigned",
  ).length;

  const overdueCount = tickets.filter(
    (ticket) => getSlaInfo(ticket, currentTime).overdue,
  ).length;

  const selectedSla = selectedTicket
    ? getSlaInfo(selectedTicket, currentTime)
    : null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">IT</div>
          <div>
            <h1>ServiceDesk</h1>
            <p>Business IT Support</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#dashboard">
            <span className="nav-symbol">▦</span>
            Dashboard
          </a>
          <a className="nav-item" href="#create-ticket">
            <span className="nav-symbol">＋</span>
            Create ticket
          </a>
        </nav>

        <div className="sidebar-footer">
          <span className="status-indicator" />
          Local development
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="page-header">
          <div>
            <p className="eyebrow">IT OPERATIONS</p>
            <h2>Service Desk Dashboard</h2>
            <p className="page-subtitle">
              Manage support requests, assignments, deadlines, and ticket
              activity.
            </p>
          </div>

          <button
            className="button button-secondary"
            type="button"
            onClick={() => void loadTickets()}
          >
            Refresh tickets
          </button>
        </header>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
            <button
              type="button"
              className="alert-dismiss"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success" role="status">
            {successMessage}
            <button
              type="button"
              className="alert-dismiss"
              onClick={() => setSuccessMessage("")}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        <section className="stats-grid" aria-label="Ticket statistics">
          <div className="stat-card">
            <div className="stat-label">Total tickets</div>
            <div className="stat-value">{tickets.length}</div>
            <div className="stat-caption">All support requests</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Open</div>
            <div className="stat-value">{openCount}</div>
            <div className="stat-caption">Awaiting action</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">In progress</div>
            <div className="stat-value">{inProgressCount}</div>
            <div className="stat-caption">Being investigated</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Resolved</div>
            <div className="stat-value">{resolvedCount}</div>
            <div className="stat-caption">Completed tickets</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Unassigned</div>
            <div className="stat-value">{unassignedCount}</div>
            <div className="stat-caption">Need an owner</div>
          </div>

          <div className={`stat-card sla-stat-card ${overdueCount > 0 ? "sla-stat-alert" : ""}`}>
            <div className="stat-label">Overdue tickets</div>
            <div className="stat-value">{overdueCount}</div>
            <div className="stat-caption">Active tickets past deadline</div>
          </div>
        </section>

        <section className="panel ticket-panel">
          <div className="section-heading">
            <div>
              <h3>Support tickets</h3>
              <p>Search, filter, and manage service requests.</p>
            </div>
            <span className="result-count">
              {filteredTickets.length} of {tickets.length}
            </span>
          </div>

          <div className="filters-grid">
            <label className="field search-field">
              <span>Search tickets</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by title, description, or ID"
              />
            </label>

            <label className="field">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="All">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Priority</span>
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
              >
                <option value="All">All priorities</option>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Assignee</span>
              <select
                value={assigneeFilter}
                onChange={(event) => setAssigneeFilter(event.target.value)}
              >
                <option value="All">All assignees</option>
                {TECHNICIANS.map((technician) => (
                  <option key={technician} value={technician}>
                    {technician}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="table-wrapper">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ticket</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Resolution SLA</th>
                  <th>Created</th>
                  <th>Details</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="table-message">
                      Loading tickets...
                    </td>
                  </tr>
                ) : filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="table-message">
                      No tickets match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((ticket) => {
                    const sla = getSlaInfo(ticket, currentTime);

                    return (
                      <tr key={ticket.id}>
                        <td className="ticket-id">#{ticket.id}</td>

                        <td className="ticket-title-cell">
                          <strong>{ticket.title}</strong>
                          <span>{ticket.description}</span>
                        </td>

                        <td>
                          <span
                            className={`priority-badge priority-${ticket.priority.toLowerCase()}`}
                          >
                            {ticket.priority}
                          </span>
                        </td>

                        <td>
                          <select
                            className={`status-select status-${ticket.status
                              .toLowerCase()
                              .replaceAll(" ", "-")}`}
                            aria-label={`Change status for ticket ${ticket.id}`}
                            value={ticket.status}
                            onChange={(event) =>
                              void updateStatus(
                                ticket,
                                event.target.value as TicketStatus,
                              )
                            }
                          >
                            {STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>
                          <span
                            className={`assignee-badge ${
                              !ticket.assignedTo ||
                              ticket.assignedTo === "Unassigned"
                                ? "assignee-unassigned"
                                : ""
                            }`}
                          >
                            {ticket.assignedTo || "Unassigned"}
                          </span>
                        </td>

                        <td>
                          <div className="sla-cell">
                            <span className={`sla-badge ${sla.className}`}>
                              {sla.label}
                            </span>
                            <span className="sla-detail">{sla.detail}</span>
                            {ticket.resolutionDueAt &&
                              ticket.status !== "Resolved" &&
                              ticket.status !== "Closed" && (
                                <span className="sla-deadline">
                                  Due {formatDate(ticket.resolutionDueAt)}
                                </span>
                              )}
                          </div>
                        </td>

                        <td className="date-cell">
                          {formatDate(ticket.createdAt)}
                        </td>

                        <td>
                          <button
                            className="button button-small button-secondary"
                            type="button"
                            onClick={() => openTicketDetails(ticket)}
                          >
                            View details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel create-panel" id="create-ticket">
          <div className="section-heading">
            <div>
              <h3>Create a support ticket</h3>
              <p>
                Record a new technical issue or service request. The resolution
                deadline is assigned automatically based on priority.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateTicket} className="create-form">
            <label className="field">
              <span>Ticket title</span>
              <input
                type="text"
                maxLength={200}
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="e.g. Unable to access shared drive"
                required
              />
            </label>

            <label className="field">
              <span>Priority</span>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value as TicketPriority,
                  }))
                }
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>

            <label className="field full-width">
              <span>Description</span>
              <textarea
                rows={4}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Describe the issue, any error messages, and the affected system."
                required
              />
            </label>

            <div className="sla-target-note full-width">
              <strong>Demo resolution targets</strong>
              <span>Critical: 4 hours</span>
              <span>High: 24 hours</span>
              <span>Medium: 72 hours</span>
              <span>Low: 120 hours</span>
              <p>Targets use calendar hours, not business hours.</p>
            </div>

            <div className="form-actions full-width">
              <button
                className="button button-primary"
                type="submit"
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create ticket"}
              </button>
            </div>
          </form>
        </section>
      </main>

      {selectedTicket && selectedSla && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeTicketDetails();
            }
          }}
        >
          <section
            className="ticket-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-modal-title"
          >
            <header className="modal-header">
              <div>
                <p className="eyebrow">TICKET #{selectedTicket.id}</p>
                <h2 id="ticket-modal-title">{selectedTicket.title}</h2>
                <p className="modal-subtitle">
                  Created {formatDate(selectedTicket.createdAt)}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeTicketDetails}
                aria-label="Close ticket details"
              >
                ×
              </button>
            </header>

            <div className="modal-body">
              <section className="detail-section">
                <h3>Ticket details</h3>
                <p className="ticket-description">
                  {selectedTicket.description}
                </p>

                <div className="detail-meta">
                  <div>
                    <span>Priority</span>
                    <strong>{selectedTicket.priority}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{selectedTicket.status}</strong>
                  </div>
                  <div>
                    <span>Assigned to</span>
                    <strong>
                      {selectedTicket.assignedTo || "Unassigned"}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="detail-section">
                <h3>Resolution SLA</h3>
                <p className="section-description">
                  The resolution target is calculated from the ticket creation
                  time using the demo priority rules.
                </p>

                <div className="sla-detail-panel">
                  <div className="sla-detail-top">
                    <span className={`sla-badge ${selectedSla.className}`}>
                      {selectedSla.label}
                    </span>
                    <strong>{selectedSla.detail}</strong>
                  </div>

                  <div className="sla-dates">
                    <div>
                      <span>Resolution deadline</span>
                      <strong>
                        {formatDate(selectedTicket.resolutionDueAt)}
                      </strong>
                    </div>
                    <div>
                      <span>Resolved at</span>
                      <strong>
                        {formatDate(selectedTicket.resolvedAt)}
                      </strong>
                    </div>
                  </div>
                </div>
              </section>

              <section className="detail-section">
                <h3>Technician assignment</h3>
                <p className="section-description">
                  Choose the team responsible for this ticket.
                </p>

                <div className="inline-edit">
                  <label className="field">
                    <span>Assign to</span>
                    <select
                      value={assignmentDraft}
                      onChange={(event) =>
                        setAssignmentDraft(event.target.value)
                      }
                    >
                      {TECHNICIANS.map((technician) => (
                        <option key={technician} value={technician}>
                          {technician}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => void saveAssignment()}
                    disabled={
                      isSavingAssignment ||
                      assignmentDraft ===
                        (selectedTicket.assignedTo || "Unassigned")
                    }
                  >
                    {isSavingAssignment ? "Saving..." : "Save assignment"}
                  </button>
                </div>
              </section>

              <section className="detail-section">
                <h3>Troubleshooting notes</h3>
                <p className="section-description">
                  Record diagnostic steps, findings, and attempted solutions.
                </p>

                <label className="field">
                  <span>Internal notes</span>
                  <textarea
                    rows={5}
                    maxLength={10000}
                    value={notesDraft}
                    onChange={(event) => setNotesDraft(event.target.value)}
                    placeholder="Example: Confirmed network connectivity, checked account permissions, and reviewed the error message..."
                  />
                </label>

                <div className="notes-footer">
                  <span>{notesDraft.length}/10,000 characters</span>
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => void saveTroubleshootingNotes()}
                    disabled={
                      isSavingNotes ||
                      notesDraft ===
                        (selectedTicket.troubleshootingNotes || "")
                    }
                  >
                    {isSavingNotes ? "Saving..." : "Save notes"}
                  </button>
                </div>
              </section>

              <section className="detail-section activity-section">
                <div className="activity-heading">
                  <div>
                    <h3>Activity history</h3>
                    <p className="section-description">
                      A chronological record of changes to this ticket.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="button button-small button-secondary"
                    onClick={() => void loadActivity(selectedTicket.id)}
                    disabled={isLoadingActivity}
                  >
                    Refresh
                  </button>
                </div>

                {isLoadingActivity ? (
                  <p className="activity-message">Loading activity...</p>
                ) : activityError ? (
                  <div className="alert alert-error" role="alert">
                    {activityError}
                    <button
                      type="button"
                      className="button button-small button-secondary"
                      onClick={() => void loadActivity(selectedTicket.id)}
                    >
                      Try again
                    </button>
                  </div>
                ) : activities.length === 0 ? (
                  <div className="activity-empty">
                    <strong>No activity recorded yet</strong>
                    <p>
                      New ticket actions will appear here with their timestamps.
                    </p>
                  </div>
                ) : (
                  <ol className="activity-timeline">
                    {activities.map((activity) => (
                      <li className="activity-item" key={activity.id}>
                        <span className="activity-dot" aria-hidden="true" />
                        <div className="activity-card">
                          <div className="activity-item-heading">
                            <strong>{activity.action}</strong>
                            <time dateTime={activity.createdAt}>
                              {formatDate(activity.createdAt)}
                            </time>
                          </div>
                          <p>{activity.details}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>

            <footer className="modal-footer">
              <button
                type="button"
                className="button button-secondary"
                onClick={closeTicketDetails}
              >
                Close details
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
