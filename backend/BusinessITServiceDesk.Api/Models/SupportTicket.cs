
namespace BusinessITServiceDesk.Api.Models;

public class SupportTicket
{
    public int Id { get; set; }

    public string Title { get; set; } = "";

    public string Description { get; set; } = "";

    public string Priority { get; set; } = "Medium";

    public string Status { get; set; } = "Open";

    public DateTime CreatedAt { get; set; }

    public string TroubleshootingNotes { get; set; } = "";

    public string AssignedTo { get; set; } = "Unassigned";

    public DateTime? ResolutionDueAt { get; set; }

    public DateTime? ResolvedAt { get; set; }
}
