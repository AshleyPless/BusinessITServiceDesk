
using BusinessITServiceDesk.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace BusinessITServiceDesk.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<SupportTicket> Tickets => Set<SupportTicket>();

    public DbSet<TicketActivity> TicketActivities =>
        Set<TicketActivity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<SupportTicket>(entity =>
        {
            entity.ToTable("Tickets");

            entity.HasKey(ticket => ticket.Id);

            entity.Property(ticket => ticket.Title)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(ticket => ticket.Description)
                .IsRequired();

            entity.Property(ticket => ticket.Priority)
                .HasMaxLength(20)
                .IsRequired()
                .HasDefaultValue("Medium");

            entity.Property(ticket => ticket.Status)
                .HasMaxLength(30)
                .IsRequired()
                .HasDefaultValue("Open");

            entity.Property(ticket => ticket.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("SYSUTCDATETIME()");

            entity.Property(ticket => ticket.TroubleshootingNotes)
                .IsRequired(false);

            entity.Property(ticket => ticket.AssignedTo)
                .HasMaxLength(100)
                .IsRequired()
                .HasDefaultValue("Unassigned");

            entity.Property(ticket => ticket.ResolutionDueAt)
                .IsRequired(false);

            entity.Property(ticket => ticket.ResolvedAt)
                .IsRequired(false);
        });

        modelBuilder.Entity<TicketActivity>(entity =>
        {
            entity.ToTable("TicketActivities");

            entity.HasKey(activity => activity.Id);

            entity.Property(activity => activity.Action)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(activity => activity.Details)
                .HasMaxLength(500)
                .IsRequired();

            entity.Property(activity => activity.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("SYSUTCDATETIME()");

            entity.HasOne<SupportTicket>()
                .WithMany()
                .HasForeignKey(activity => activity.TicketId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
