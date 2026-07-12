-- Requested operational reset: remove every tutorial team and its derived links.
-- Team members, channel items and assignment progress cascade from tutor_teams.
DELETE FROM public.tutorship_assignments AS assignment
USING public.tutor_team_members AS member, public.tutor_teams AS team
WHERE member.team_id = team.id
  AND assignment.tutor_id = team.tutor_id
  AND assignment.student_id = member.student_id;

DELETE FROM public.tutor_teams;
