import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

interface ContactPayload {
  name: string
  email: string
  msg: string
}

export async function POST(request: Request) {
  const body: ContactPayload = await request.json()
  const { name, email, msg } = body

  if (!name || !email || !msg) {
    return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 })
  }

  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'andersonventosilla0@gmail.com',
      subject: `[Arcade Vault] Mensaje de ${name}`,
      html: `
        <p><strong>Nombre:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Mensaje:</strong></p>
        <p>${msg.replace(/\n/g, '<br>')}</p>
      `,
    })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false, error: 'Send failed' }, { status: 500 })
  }
}
