
using BusinessITServiceDesk.Api.Data;
using BusinessITServiceDesk.Api.Models;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

app.UseCors("FrontendPolicy");

app.MapGet("/", () => Results.Ok(new
{
    message = "Business IT Service Desk API is running."
}));

// Return all tickets.
app.MapGet("/api/tickets", async (AppDbContext db) =>
{
    var tickets = await db.Tickets
        .AsNoTracking()
        .OrderByDescending(ticket => ticket.CreatedAt)
        .ToListAsync();

    return Results.Ok(tickets);
});

// Return one ticket.
app.MapGet("/api/tickets/{id:int}", async (
    int id,
    AppDbContext db) =>
{
    var ticket = await db.Tickets
        .AsNoTracking()
        .FirstOrDefaultAsync(ticket => ticket.Id == id);

    return ticket is null
        ? Results.NotFound(new { message = "Ticket not found." })
        : Results.Ok(ticket);
});

// Return the activity history for a ticket.
app.MapGet("/api/tickets/{id:int}/activity", async (
    int id,
    AppDbContext db) =>
{
    var ticketExists = await db.Tickets
        .AnyAsync(ticket => ticket.Id == id);

    if (!ticketExists)
    {
        return Results.NotFound(new { message = "Ticket not found." });
    }

    var activities = await db.TicketActivities
        .AsNoTracking()
        .Where(activity => activity.TicketId == id)
        .OrderByDescending(activity => activity.CreatedAt)
        .ToListAsync();

    return Results.Ok(activities);
});

// Create a ticket and calculate its resolution deadline.
app.MapPost("/api/tickets", async (
    CreateTicketRequest request,
    AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(request.Title) ||
        string.IsNullOrWhiteSpace(request.Description))
    {
        return Results.BadRequest(new
        {
            message = "Title and description are required."
        });
    }

    var priority = NormalizePriority(request.Priority);

    if (priority is null)
    {
        return Results.BadRequest(new
        {
            message = "Priority must be Critical, High, Medium, or Low."
        });
    }

    var createdAt = DateTime.UtcNow;

    var ticket = new SupportTicket
    {
        Title = request.Title.Trim(),
        Description = request.Description.Trim(),
        Priority = priority,
        Status = "Open",
        CreatedAt = createdAt,
        AssignedTo = "Unassigned",
        TroubleshootingNotes = "",
        ResolutionDueAt = createdAt.AddHours(GetResolutionTargetHours(priority)),
        ResolvedAt = null
    };

    db.Tickets.Add(ticket);

    await db.SaveChangesAsync();

    db.TicketActivities.Add(new TicketActivity
    {
        TicketId = ticket.Id,
        Action = "Ticket created",
        Details = $"Ticket created with {ticket.Priority} priority.",
        CreatedAt = DateTime.UtcNow
    });

    await db.SaveChangesAsync();

    return Results.Created($"/api/tickets/{ticket.Id}", ticket);
});

// Change ticket status and track resolution.
app.MapPatch("/api/tickets/{id:int}/status", async (
    int id,
    UpdateTicketStatusRequest request,
    AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(request.Status))
    {
        return Results.BadRequest(new
        {
            message = "Status is required."
        });
    }

    var allowedStatuses = new[]
    {
        "Open",
        "In Progress",
        "Resolved",
        "Closed"
    };

    var newStatus = allowedStatuses.FirstOrDefault(status =>
        string.Equals(status, request.Status.Trim(),
            StringComparison.OrdinalIgnoreCase));

    if (newStatus is null)
    {
        return Results.BadRequest(new
        {
            message = "Status must be Open, In Progress, Resolved, or Closed."
        });
    }

    var ticket = await db.Tickets
        .FirstOrDefaultAsync(ticket => ticket.Id == id);

    if (ticket is null)
    {
        return Results.NotFound(new { message = "Ticket not found." });
    }

    var previousStatus = ticket.Status;

    if (string.Equals(previousStatus, newStatus,
            StringComparison.OrdinalIgnoreCase))
    {
        return Results.Ok(ticket);
    }

    ticket.Status = newStatus;

    if (newStatus == "Resolved")
    {
        ticket.ResolvedAt = DateTime.UtcNow;
    }
    else if (previousStatus == "Resolved")
    {
        // If a resolved ticket is reopened or moved to another status,
        // clear the current resolution timestamp.
        ticket.ResolvedAt = null;
    }

    db.TicketActivities.Add(new TicketActivity
    {
        TicketId = ticket.Id,
        Action = "Status changed",
        Details = $"Status changed from {previousStatus} to {newStatus}.",
        CreatedAt = DateTime.UtcNow
    });

    if (newStatus == "Resolved")
    {
        db.TicketActivities.Add(new TicketActivity
        {
            TicketId = ticket.Id,
            Action = "Ticket resolved",
            Details = $"Ticket resolved at {ticket.ResolvedAt:yyyy-MM-dd HH:mm} UTC.",
            CreatedAt = DateTime.UtcNow
        });
    }

    await db.SaveChangesAsync();

    return Results.Ok(ticket);
});

// Update troubleshooting notes.
app.MapPut("/api/tickets/{id:int}/notes", async (
    int id,
    UpdateTicketNotesRequest request,
    AppDbContext db) =>
{
    var ticket = await db.Tickets
        .FirstOrDefaultAsync(ticket => ticket.Id == id);

    if (ticket is null)
    {
        return Results.NotFound(new { message = "Ticket not found." });
    }

    var newNotes = request.Notes ?? "";

    if (ticket.TroubleshootingNotes != newNotes)
    {
        ticket.TroubleshootingNotes = newNotes;

        db.TicketActivities.Add(new TicketActivity
        {
            TicketId = ticket.Id,
            Action = "Notes updated",
            Details = "Troubleshooting notes were updated.",
            CreatedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync();
    }

    return Results.Ok(ticket);
});

// Assign a ticket to a technician.
app.MapPut("/api/tickets/{id:int}/assignment", async (
    int id,
    UpdateTicketAssignmentRequest request,
    AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(request.AssignedTo))
    {
        return Results.BadRequest(new
        {
            message = "Technician assignment is required."
        });
    }

    var ticket = await db.Tickets
        .FirstOrDefaultAsync(ticket => ticket.Id == id);

    if (ticket is null)
    {
        return Results.NotFound(new { message = "Ticket not found." });
    }

    var newAssignee = request.AssignedTo.Trim();

    if (newAssignee.Length > 100)
    {
        return Results.BadRequest(new
        {
            message = "Technician name cannot exceed 100 characters."
        });
    }

    if (ticket.AssignedTo != newAssignee)
    {
        var previousAssignee = ticket.AssignedTo;
        ticket.AssignedTo = newAssignee;

        db.TicketActivities.Add(new TicketActivity
        {
            TicketId = ticket.Id,
            Action = "Assignment changed",
            Details = $"Assigned from {previousAssignee} to {newAssignee}.",
            CreatedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync();
    }

    return Results.Ok(ticket);
});

app.Run();

// SLA resolution targets are demo calendar-hour targets.
static int GetResolutionTargetHours(string priority)
{
    return priority switch
    {
        "Critical" => 4,
        "High" => 24,
        "Medium" => 72,
        "Low" => 120,
        _ => 72
    };
}

static string? NormalizePriority(string? priority)
{
    if (string.IsNullOrWhiteSpace(priority))
    {
        return "Medium";
    }

    return new[] { "Critical", "High", "Medium", "Low" }
        .FirstOrDefault(value =>
            string.Equals(value, priority.Trim(),
                StringComparison.OrdinalIgnoreCase));
}

record CreateTicketRequest(
    string Title,
    string Description,
    string Priority = "Medium");

record UpdateTicketStatusRequest(string Status);

record UpdateTicketNotesRequest(string? Notes);

record UpdateTicketAssignmentRequest(string AssignedTo);
