export const dynamic = 'force-dynamic'
export const runtime = 'edge'

import { redirect } from 'next/navigation'

export default async function SubdomainRoot({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  redirect(`/${subdomain}/projects`)
}
