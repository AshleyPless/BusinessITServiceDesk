
namespace BusinessITServiceDesk.Api.Models;

public class TicketActivity
{
    public int Id { get; set; }

    public int TicketId { get; set; }

    public string Action { get; set; } = "";

    public string Details { get; set; } = "";

    public DateTime CreatedAt { get; set; }
}
