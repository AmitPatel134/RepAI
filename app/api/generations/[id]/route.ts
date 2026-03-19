export async function DELETE() {
  return Response.json({ error: "Not found" }, { status: 404 })
}
